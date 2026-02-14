import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

export const get = query({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
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
