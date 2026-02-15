import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

/** Internal-only query for CLI debugging — no auth required. */
export const _listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("skills").collect();
  },
});

/** Backfill envKeys, dependencies, and runtime from metadata JSON in skill content. */
export const _backfillMetadata = internalMutation({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").collect();
    let updated = 0;

    for (const skill of skills) {
      const fmMatch = skill.content.match(/^---\s*\n([\s\S]*?)\n---/);

      // Extract body content for scanning (works even without frontmatter)
      const fmEnd = skill.content.indexOf("\n---", skill.content.indexOf("---") + 3);
      const bodyContent = fmEnd >= 0 ? skill.content.slice(fmEnd + 4) : skill.content;

      // Parse metadata if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let oc: Record<string, any> | null = null;
      if (fmMatch) {
        const metadataRaw = extractMetadata(fmMatch[1]);
        if (metadataRaw) {
          try {
            const cleaned = metadataRaw
              .split("\n")
              .map((l: string) => l.trim())
              .join("")
              .trim();
            const meta = JSON.parse(cleaned);
            oc = meta.openclaw || meta.clawdbot || null;
          } catch {
            // skip invalid JSON
          }
        }
      }

      const patch: Record<string, unknown> = {};

      // Backfill envKeys — from metadata requires.env + body export patterns
      {
        const envKeys: Array<{ key: string; description: string; required: boolean }> = [];
        const seenKeys = new Set<string>();

        // From metadata requires.env
        if (oc?.requires?.env && Array.isArray(oc.requires.env)) {
          const primaryEnv = oc.primaryEnv || "";
          for (const envVar of oc.requires.env as string[]) {
            envKeys.push({
              key: envVar,
              description: envVar === primaryEnv ? "Primary environment key" : "",
              required: envVar === primaryEnv,
            });
            seenKeys.add(envVar);
          }
        }

        // From body export KEY=value patterns
        const exportMatches = bodyContent.match(/export\s+([A-Z][A-Z0-9_]+)=/g);
        if (exportMatches) {
          for (const m of exportMatches) {
            const key = m.replace(/export\s+/, "").replace("=", "");
            if (key && !seenKeys.has(key) && !["PATH", "HOME", "USER", "SHELL"].includes(key)) {
              envKeys.push({ key, description: "", required: false });
              seenKeys.add(key);
            }
          }
        }

        if (envKeys.length > 0) {
          const currentKeys = new Set((skill.envKeys || []).map((e: { key: string }) => e.key));
          const hasNew = envKeys.some(e => !currentKeys.has(e.key));
          if (!skill.envKeys || skill.envKeys.length === 0 || hasNew) {
            patch.envKeys = envKeys;
          }
        }
      }

      // Backfill dependencies — from metadata install + body npm/pip patterns
      {
        const packages: string[] = [];

        // From metadata install entries (package, formula, module)
        if (oc?.install && Array.isArray(oc.install)) {
          for (const inst of oc.install) {
            const pkg = inst.package || inst.formula || inst.module;
            if (pkg && !packages.includes(pkg)) packages.push(pkg);
          }
        }

        // From body npm install / pip install patterns
        const npmMatches = bodyContent.match(/npm install\s+(?:-[gD]\s+)?(@?[\w/.@-]+)/g);
        if (npmMatches) {
          for (const m of npmMatches) {
            const pkg = m.replace(/npm install\s+(?:-[gD]\s+)?/, "").trim();
            if (pkg && pkg !== "npx" && !packages.includes(pkg)) packages.push(pkg);
          }
        }
        const pipMatches = bodyContent.match(/pip install\s+([\w._-]+)/g);
        if (pipMatches) {
          for (const m of pipMatches) {
            const pkg = m.replace(/pip install\s+/, "").trim();
            if (pkg && !pkg.startsWith("-") && !packages.includes(pkg)) packages.push(pkg);
          }
        }

        if (packages.length > 0) {
          patch.dependencies = packages.join(", ");
        } else if (skill.dependencies) {
          patch.dependencies = undefined;
        }
      }

      // Backfill runtime
      if (!skill.runtime || skill.runtime === "none") {
        let inferred: "node" | "python" | null = null;

        // From metadata bins/install kinds
        if (oc) {
          const bins: string[] = oc.requires?.bins || [];
          const kinds: string[] = (oc.install || []).map((i: { kind?: string }) => i.kind || "");
          const all = [...bins, ...kinds].join(" ").toLowerCase();
          if (all.includes("node") || all.includes("npx") || all.includes("npm")) {
            inferred = "node";
          } else if (all.includes("python") || all.includes("pip")) {
            inferred = "python";
          }
        }

        // From body content patterns
        if (!inferred) {
          const hasNode = /npm install|npx\s|package\.json|node_modules|require\(["']/.test(bodyContent);
          const hasPython = /pip install|python3?\s|\.py\b|requirements\.txt/.test(bodyContent);
          if (hasNode && !hasPython) {
            inferred = "node";
          } else if (hasPython && !hasNode) {
            inferred = "python";
          } else if (hasNode && hasPython) {
            const nodeCount = (bodyContent.match(/npm install|npx\s|package\.json|require\(/g) || []).length;
            const pyCount = (bodyContent.match(/pip install|python3?\s|\.py\b|requirements\.txt/g) || []).length;
            inferred = pyCount > nodeCount ? "python" : "node";
          }
        }

        if (inferred) patch.runtime = inferred;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(skill._id, patch);
        updated++;
      }
    }

    return { total: skills.length, updated };
  },
});

function extractMetadata(frontmatter: string): string | null {
  const lines = frontmatter.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("metadata:")) {
      let value = line.slice("metadata:".length).trim();
      const extra: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        extra.push(lines[i + 1]);
        i++;
      }
      if (extra.length > 0) {
        value = (value + "\n" + extra.join("\n")).trim();
      }
      return value || null;
    }
  }
  return null;
}

const envKeyValidator = v.object({
  key: v.string(),
  description: v.string(),
  required: v.boolean(),
});

export const get = query({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("skills").collect();
  },
});

export const listAvailable = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const org = await ctx.db.get(orgId);
    if (!org) return [];

    const enabledSkills = await ctx.db
      .query("skills")
      .withIndex("by_isEnabled", (q) => q.eq("isEnabled", true))
      .collect();

    return enabledSkills.filter((s) => s.plans.includes(org.plan));
  },
});

export const getByName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("mcp"),
      v.literal("prompt"),
      v.literal("workflow"),
    ),
    sourceRepo: v.optional(v.string()),
    content: v.string(),
    entryPoint: v.optional(v.string()),
    runtime: v.optional(
      v.union(
        v.literal("node"),
        v.literal("python"),
        v.literal("none"),
      ),
    ),
    dependencies: v.optional(v.string()),
    envKeys: v.optional(v.array(envKeyValidator)),
    isEnabled: v.boolean(),
    plans: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) throw new Error("Skill name already exists");
    return ctx.db.insert("skills", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("skills"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("mcp"),
        v.literal("prompt"),
        v.literal("workflow"),
      ),
    ),
    sourceRepo: v.optional(v.string()),
    content: v.optional(v.string()),
    entryPoint: v.optional(v.string()),
    runtime: v.optional(
      v.union(
        v.literal("node"),
        v.literal("python"),
        v.literal("none"),
      ),
    ),
    dependencies: v.optional(v.string()),
    envKeys: v.optional(v.array(envKeyValidator)),
    isEnabled: v.optional(v.boolean()),
    plans: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const assignments = await ctx.db
      .query("instanceSkills")
      .withIndex("by_skillId", (q) => q.eq("skillId", args.id))
      .collect();
    for (const a of assignments) {
      await ctx.db.delete(a._id);
    }
    const envValues = await ctx.db
      .query("skillEnvValues")
      .withIndex("by_skillId", (q) => q.eq("skillId", args.id))
      .collect();
    for (const e of envValues) {
      await ctx.db.delete(e._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const importFromContent = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("mcp"),
      v.literal("prompt"),
      v.literal("workflow"),
    ),
    content: v.string(),
    sourceRepo: v.optional(v.string()),
    entryPoint: v.optional(v.string()),
    runtime: v.optional(
      v.union(
        v.literal("node"),
        v.literal("python"),
        v.literal("none"),
      ),
    ),
    dependencies: v.optional(v.string()),
    envKeys: v.optional(v.array(envKeyValidator)),
    plans: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      const { name: _name, ...updateFields } = args;
      const updates: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [k, val] of Object.entries(updateFields)) {
        if (val !== undefined) updates[k] = val;
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }
    return ctx.db.insert("skills", {
      ...args,
      isEnabled: true,
      plans: args.plans ?? ["free", "starter", "pro", "enterprise"],
      updatedAt: Date.now(),
    });
  },
});
