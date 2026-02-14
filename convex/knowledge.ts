import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

export const list = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const entries = await ctx.db
      .query("knowledge")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    // Sort newest-first
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getByKey = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return null;

    return ctx.db
      .query("knowledge")
      .withIndex("by_orgId_key", (q) => q.eq("orgId", orgId).eq("key", args.key))
      .unique();
  },
});

export const search = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    return ctx.db
      .query("knowledge")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("orgId", orgId),
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    key: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) throw new Error("Organization required");
    if (orgRole === "viewer") throw new Error("Viewer cannot create knowledge entries");

    // Check uniqueness of key within org
    const existing = await ctx.db
      .query("knowledge")
      .withIndex("by_orgId_key", (q) => q.eq("orgId", orgId).eq("key", args.key))
      .unique();
    if (existing) throw new Error("A knowledge entry with this key already exists");

    return ctx.db.insert("knowledge", {
      orgId,
      key: args.key,
      content: args.content,
      tags: args.tags,
      source: "human",
      createdBy: userId,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("knowledge"),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Knowledge entry not found");

    const { orgRole } = await requireOrgAccess(ctx, entry.orgId);
    if (orgRole === "viewer") throw new Error("Viewer cannot edit knowledge entries");

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("knowledge") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Knowledge entry not found");

    const { orgRole } = await requireOrgAccess(ctx, entry.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to delete knowledge entries");
    }

    await ctx.db.delete(args.id);
  },
});

export const createFromProposal = mutation({
  args: {
    orgId: v.id("organizations"),
    key: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    sourceAgentId: v.optional(v.string()),
    sourceInstanceId: v.optional(v.id("gatewayInstances")),
  },
  handler: async (ctx, args) => {
    const { orgRole } = await requireOrgAccess(ctx, args.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to approve proposals");
    }

    // Upsert: if key exists, update; otherwise insert
    const existing = await ctx.db
      .query("knowledge")
      .withIndex("by_orgId_key", (q) =>
        q.eq("orgId", args.orgId).eq("key", args.key),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        tags: args.tags,
        source: "agent" as const,
        sourceAgentId: args.sourceAgentId,
        sourceInstanceId: args.sourceInstanceId,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("knowledge", {
      orgId: args.orgId,
      key: args.key,
      content: args.content,
      tags: args.tags,
      source: "agent",
      sourceAgentId: args.sourceAgentId,
      sourceInstanceId: args.sourceInstanceId,
      updatedAt: Date.now(),
    });
  },
});
