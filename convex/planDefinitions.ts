import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("planDefinitions").collect();
  },
});

export const getByPlan = query({
  args: { plan: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("planDefinitions")
      .withIndex("by_plan", (q) => q.eq("plan", args.plan))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    plan: v.string(),
    displayName: v.string(),
    monthlyBaseCents: v.number(),
    includedInstances: v.number(),
    includedAgentsPerInstance: v.number(),
    overagePerInstanceCents: v.number(),
    overagePerAgentCents: v.number(),
    llmMarkupPercent: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const existing = await ctx.db
      .query("planDefinitions")
      .withIndex("by_plan", (q) => q.eq("plan", args.plan))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("planDefinitions", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("planDefinitions") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
