import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/admin/skills/import
 *
 * Discovers skills from a GitHub repository by:
 * 1. Fetching the repo tree
 * 2. Finding SKILL.md files (at skills/<name>/SKILL.md or root SKILL.md)
 * 3. Parsing YAML frontmatter for metadata
 * 4. Returning discovered skills for the admin to select which to import
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoUrl } = body as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Missing repoUrl in request body" },
        { status: 400 },
      );
    }

    // Extract owner/repo from GitHub URL
    const match = repoUrl.match(
      /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
    );
    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitHub URL. Expected: https://github.com/owner/repo" },
        { status: 400 },
      );
    }
    const [, owner, repo] = match;

    // Fetch repo tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "openclaw-studio",
        },
      },
    );

    if (!treeRes.ok) {
      // Try 'master' branch as fallback
      const masterRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "openclaw-studio",
          },
        },
      );
      if (!masterRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch repo tree: ${treeRes.status}` },
          { status: 502 },
        );
      }
      const masterData = await masterRes.json();
      return processTree(masterData, owner!, repo!);
    }

    const treeData = await treeRes.json();
    return processTree(treeData, owner!, repo!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function processTree(
  treeData: { tree: Array<{ path: string; type: string }> },
  owner: string,
  repo: string,
) {
  const tree = treeData.tree ?? [];

  // Find SKILL.md files — match patterns:
  // skills/<name>/SKILL.md
  // <name>/SKILL.md
  // SKILL.md (root)
  const skillPaths = tree
    .filter(
      (node: { path: string; type: string }) =>
        node.type === "blob" && /SKILL\.md$/i.test(node.path),
    )
    .map((node: { path: string }) => node.path);

  if (skillPaths.length === 0) {
    return NextResponse.json({
      skills: [],
      message: "No SKILL.md files found in repository",
    });
  }

  // Fetch and parse each SKILL.md
  const fetchPromises = skillPaths.map(async (filePath: string) => {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
      const res = await fetch(rawUrl);
      if (!res.ok) {
        // Try master
        const masterRes = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${filePath}`,
        );
        if (!masterRes.ok) return null;
        const content = await masterRes.text();
        return parseSkillMd(content, filePath, owner, repo);
      }
      const content = await res.text();
      return parseSkillMd(content, filePath, owner, repo);
    } catch {
      return null;
    }
  });

  return Promise.all(fetchPromises).then((results) => {
    const skills = results.filter(Boolean);
    return NextResponse.json({ skills });
  });
}

function parseSkillMd(
  content: string,
  filePath: string,
  owner: string,
  repo: string,
) {
  // Extract frontmatter between --- delimiters
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};

  if (fmMatch) {
    const fmContent = fmMatch[1];
    for (const line of fmContent.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
        frontmatter[key] = value;
      }
    }
  }

  // Derive skill name from path
  const pathParts = filePath.split("/");
  const dirName =
    pathParts.length >= 2
      ? pathParts[pathParts.length - 2]
      : repo;
  const name = frontmatter.name || dirName;
  const displayName =
    frontmatter.displayName ||
    frontmatter.display_name ||
    frontmatter.title ||
    name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const category = inferCategory(
    frontmatter.category || frontmatter.type || "",
  );
  const runtime = inferRuntime(
    frontmatter.runtime || frontmatter.language || "",
  );

  return {
    name,
    displayName,
    description:
      frontmatter.description || `Imported from ${owner}/${repo}`,
    category,
    runtime,
    content,
    sourceRepo: `https://github.com/${owner}/${repo}`,
    entryPoint: frontmatter.entryPoint || frontmatter.entry_point || undefined,
    dependencies: frontmatter.dependencies || undefined,
    filePath,
  };
}

function inferCategory(
  value: string,
): "mcp" | "prompt" | "workflow" {
  const lower = value.toLowerCase();
  if (lower.includes("mcp") || lower.includes("tool") || lower.includes("server"))
    return "mcp";
  if (lower.includes("workflow") || lower.includes("chain"))
    return "workflow";
  return "prompt";
}

function inferRuntime(
  value: string,
): "node" | "python" | "none" {
  const lower = value.toLowerCase();
  if (lower.includes("node") || lower.includes("typescript") || lower.includes("javascript"))
    return "node";
  if (lower.includes("python")) return "python";
  return "none";
}
