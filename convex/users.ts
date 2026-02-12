import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireSuperAdmin } from "./lib/authorization";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const user = await ctx.db.get(userId);
    return { user, profile };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").collect();
    const result = [];
    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (user) {
        result.push({ ...profile, email: (user as Record<string, unknown>).email ?? null });
      }
    }
    return result;
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("superAdmin"),
      v.literal("orgAdmin"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, {
      role: args.role,
      updatedAt: Date.now(),
    });
  },
});
