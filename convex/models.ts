import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("models").collect();
  },
});

export const listByProvider = query({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return ctx.db
      .query("models")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();
  },
});

export const create = mutation({
  args: {
    providerId: v.id("providers"),
    modelId: v.string(),
    name: v.string(),
    capabilities: v.optional(
      v.object({
        reasoning: v.optional(v.boolean()),
        vision: v.optional(v.boolean()),
        toolCalling: v.optional(v.boolean()),
        streaming: v.optional(v.boolean()),
      }),
    ),
    contextWindow: v.optional(v.number()),
    maxOutputTokens: v.optional(v.number()),
    costPer1kInput: v.optional(v.number()),
    costPer1kOutput: v.optional(v.number()),
    isEnabled: v.boolean(),
    isDefault: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("models")
      .withIndex("by_providerId_modelId", (q) =>
        q.eq("providerId", args.providerId).eq("modelId", args.modelId),
      )
      .unique();
    if (existing) throw new Error("Model already exists for this provider");
    return ctx.db.insert("models", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("models"),
    name: v.optional(v.string()),
    capabilities: v.optional(
      v.object({
        reasoning: v.optional(v.boolean()),
        vision: v.optional(v.boolean()),
        toolCalling: v.optional(v.boolean()),
        streaming: v.optional(v.boolean()),
      }),
    ),
    contextWindow: v.optional(v.number()),
    maxOutputTokens: v.optional(v.number()),
    costPer1kInput: v.optional(v.number()),
    costPer1kOutput: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
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
  args: { id: v.id("models") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
