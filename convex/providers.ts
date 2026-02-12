import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("providers").collect();
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("llm"),
      v.literal("tts"),
      v.literal("stt"),
      v.literal("image"),
    ),
    baseUrl: v.optional(v.string()),
    supportsOAuth: v.optional(v.boolean()),
    isEnabled: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("providers")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Provider slug already exists");
    return ctx.db.insert("providers", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("providers"),
    name: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    supportsOAuth: v.optional(v.boolean()),
    isEnabled: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
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
  args: { id: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const creds = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.id))
      .collect();
    for (const c of creds) {
      await ctx.db.delete(c._id);
    }
    const models = await ctx.db
      .query("models")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.id))
      .collect();
    for (const m of models) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.id);
  },
});
