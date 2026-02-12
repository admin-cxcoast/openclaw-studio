import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

const MASKED = "********";

export const list = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("general"),
        v.literal("ai"),
        v.literal("agent"),
        v.literal("identity"),
        v.literal("vps"),
        v.literal("security"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    let settings;
    if (args.category) {
      settings = await ctx.db
        .query("systemSettings")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      settings = await ctx.db.query("systemSettings").collect();
    }
    return settings.map((s) => ({
      ...s,
      value: s.sensitive ? MASKED : s.value,
    }));
  },
});

export const reveal = query({
  args: { id: v.id("systemSettings") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const setting = await ctx.db.get(args.id);
    if (!setting) throw new Error("Setting not found");
    return setting.value;
  },
});

export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const setting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!setting) return null;
    return {
      ...setting,
      value: setting.sensitive ? MASKED : setting.value,
    };
  },
});

export const upsert = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("ai"),
      v.literal("agent"),
      v.literal("identity"),
      v.literal("vps"),
      v.literal("security"),
    ),
    description: v.optional(v.string()),
    sensitive: v.boolean(),
    inputType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.sensitive && args.value === MASKED) return;

    const existing = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        category: args.category,
        description: args.description,
        sensitive: args.sensitive,
        inputType: args.inputType,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("systemSettings", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});
