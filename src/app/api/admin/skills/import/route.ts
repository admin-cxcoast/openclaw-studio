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

    // Fetch repo tree — try main, fall back to master
    let branch = "main";
    let treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "openclaw-studio",
        },
      },
    );

    if (!treeRes.ok) {
      branch = "master";
      treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "openclaw-studio",
          },
        },
      );
      if (!treeRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch repo tree: ${treeRes.status}` },
          { status: 502 },
        );
      }
    }

    const treeData = await treeRes.json();
    return processTree(treeData, owner!, repo!, branch);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function processTree(
  treeData: { tree: Array<{ path: string; type: string }> },
  owner: string,
  repo: string,
  branch: string,
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
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      const res = await fetch(rawUrl);
      if (!res.ok) return null;
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
    const lines = fmContent.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");

        // Handle multi-line values (indented continuation or multi-line JSON)
        if (key === "metadata" || key === "description") {
          const extraLines: string[] = [];
          while (i + 1 < lines.length) {
            const next = lines[i + 1];
            // Continuation if next line is indented or empty, and not a new top-level key
            if (/^\s+\S/.test(next) || next.trim() === "") {
              extraLines.push(next);
              i++;
            } else {
              break;
            }
          }
          if (extraLines.length > 0) {
            value = (value + "\n" + extraLines.join("\n")).trim();
          }
        }

        frontmatter[key] = value;
      }
      i++;
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

  // Parse metadata JSON for enrichment
  const metadataRaw = frontmatter.metadata || "";
  const parsedMeta = parseMetadataJson(metadataRaw);

  // Extract body content (everything after the second ---)
  const fmEnd = content.indexOf("\n---", content.indexOf("---") + 3);
  const bodyContent = fmEnd >= 0 ? content.slice(fmEnd + 4) : content;

  const category = inferCategory(
    frontmatter.category || frontmatter.type || "",
  );
  const runtime = inferRuntime(
    frontmatter.runtime || frontmatter.language || "",
    parsedMeta,
    bodyContent,
  );

  const envKeys = parseEnvKeys(
    frontmatter.envKeys || "",
    fmMatch?.[1] || "",
    metadataRaw,
    bodyContent,
  );

  const dependencies =
    frontmatter.dependencies ||
    extractDependencies(parsedMeta, bodyContent) ||
    undefined;

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
    dependencies,
    envKeys: envKeys.length > 0 ? envKeys : undefined,
    filePath,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMetadataJson(raw: string): Record<string, any> | null {
  if (!raw.trim()) return null;
  try {
    const cleaned = raw
      .split("\n")
      .map((l) => l.trim())
      .join("")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/** Extract installable package dependencies from metadata and body content. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDependencies(meta: Record<string, any> | null, body: string): string | null {
  const packages: string[] = [];

  // 1. From metadata install entries — check package, formula, and module fields
  if (meta) {
    const oc = meta.openclaw || meta.clawdbot;
    if (oc?.install && Array.isArray(oc.install)) {
      for (const inst of oc.install) {
        const pkg = inst.package || inst.formula || inst.module;
        if (pkg && !packages.includes(pkg)) {
          packages.push(pkg);
        }
      }
    }
  }

  // 2. From body content — scan for npm install / pip install patterns
  if (body) {
    const npmMatches = body.match(/npm install\s+(?:-[gD]\s+)?(@?[\w/.@-]+)/g);
    if (npmMatches) {
      for (const m of npmMatches) {
        const pkg = m.replace(/npm install\s+(?:-[gD]\s+)?/, "").trim();
        if (pkg && pkg !== "npx" && !packages.includes(pkg)) {
          packages.push(pkg);
        }
      }
    }
    const pipMatches = body.match(/pip install\s+([\w._-]+)/g);
    if (pipMatches) {
      for (const m of pipMatches) {
        const pkg = m.replace(/pip install\s+/, "").trim();
        // Skip flags like -r, -e, etc.
        if (pkg && !pkg.startsWith("-") && !packages.includes(pkg)) {
          packages.push(pkg);
        }
      }
    }
  }

  return packages.length > 0 ? packages.join(", ") : null;
}

function parseEnvKeys(
  simpleValue: string,
  rawFrontmatter: string,
  metadataRaw: string,
  body: string,
): Array<{ key: string; description: string; required: boolean }> {
  // 1. Check for structured YAML list in raw frontmatter (envKeys: ...)
  const structuredMatch = rawFrontmatter.match(
    /envKeys:\s*\n((?:\s+-\s+[\s\S]*?)(?=\n\w|\n---|$))/,
  );

  if (structuredMatch) {
    const block = structuredMatch[1];
    const items: Array<{ key: string; description: string; required: boolean }> = [];
    const entries = block.split(/\n\s+-\s+/).filter(Boolean);

    for (const entry of entries) {
      const lines = entry.trim().split("\n").map((l) => l.trim());
      const obj: Record<string, string> = {};
      for (const line of lines) {
        const cleanLine = line.replace(/^-\s+/, "");
        const idx = cleanLine.indexOf(":");
        if (idx > 0) {
          const k = cleanLine.slice(0, idx).trim();
          const val = cleanLine.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
          obj[k] = val;
        }
      }
      if (obj.key) {
        items.push({
          key: obj.key,
          description: obj.description || "",
          required: obj.required === "true" || obj.required === undefined,
        });
      }
    }
    if (items.length > 0) return items;
  }

  // 2. Simple comma-separated format: envKeys: KEY1, KEY2
  if (simpleValue.trim()) {
    return simpleValue
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .map((key) => ({ key, description: "", required: true }));
  }

  // 3. Extract from metadata JSON: {"openclaw":{"requires":{"env":["KEY1","KEY2"]},"primaryEnv":"KEY1"}}
  let metaKeys: Array<{ key: string; description: string; required: boolean }> = [];
  if (metadataRaw.trim()) {
    try {
      const cleaned = metadataRaw
        .split("\n")
        .map((l) => l.trim())
        .join("")
        .trim();
      const meta = JSON.parse(cleaned);
      const oc = meta.openclaw || meta.clawdbot;
      if (oc?.requires?.env && Array.isArray(oc.requires.env)) {
        const primaryEnv = oc.primaryEnv || "";
        metaKeys = oc.requires.env.map((envVar: string) => ({
          key: envVar,
          description: envVar === primaryEnv ? "Primary environment key" : "",
          required: envVar === primaryEnv,
        }));
      }
    } catch {
      // Invalid JSON — skip
    }
  }

  // 4. Merge with env vars from body content (export KEY=value patterns)
  const bodyEnvMatches = body.match(/export\s+([A-Z][A-Z0-9_]+)=/g);
  if (bodyEnvMatches) {
    const existingKeys = new Set(metaKeys.map((e) => e.key));
    for (const m of bodyEnvMatches) {
      const key = m.replace(/export\s+/, "").replace("=", "");
      // Skip generic vars like PATH, HOME, etc.
      if (key && !existingKeys.has(key) && !["PATH", "HOME", "USER", "SHELL"].includes(key)) {
        metaKeys.push({ key, description: "", required: false });
        existingKeys.add(key);
      }
    }
  }

  return metaKeys;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any> | null,
  body: string,
): "node" | "python" | "none" {
  const lower = value.toLowerCase();
  if (lower.includes("node") || lower.includes("typescript") || lower.includes("javascript"))
    return "node";
  if (lower.includes("python")) return "python";

  // Infer from metadata bins
  if (meta) {
    const oc = meta.openclaw || meta.clawdbot;
    const bins: string[] = oc?.requires?.bins || [];
    const packages: string[] = (oc?.install || []).map((i: { kind?: string }) => i.kind || "");
    const all = [...bins, ...packages].join(" ").toLowerCase();
    if (all.includes("node") || all.includes("npx") || all.includes("npm"))
      return "node";
    if (all.includes("python") || all.includes("pip"))
      return "python";
  }

  // Infer from body content patterns
  const hasNode = /npm install|npx\s|package\.json|node_modules|require\(["']/.test(body);
  const hasPython = /pip install|python3?\s|\.py\b|requirements\.txt/.test(body);

  if (hasNode && !hasPython) return "node";
  if (hasPython && !hasNode) return "python";
  // When both are present, pick the dominant one
  if (hasNode && hasPython) {
    const nodeCount = (body.match(/npm install|npx\s|package\.json|require\(/g) || []).length;
    const pyCount = (body.match(/pip install|python3?\s|\.py\b|requirements\.txt/g) || []).length;
    return pyCount > nodeCount ? "python" : "node";
  }

  return "none";
}
