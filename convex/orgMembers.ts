import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const result = [];
    for (const m of members) {
      const user = await ctx.db.get(m.userId);
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", m.userId))
        .unique();
      result.push({
        ...m,
        email: user ? ((user as Record<string, unknown>).email ?? null) : null,
        name: profile?.name ?? null,
      });
    }
    return result;
  },
});

export const add = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("orgMembers")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .unique();
    if (existing) throw new Error("User is already a member of this organization");
    const now = Date.now();
    return ctx.db.insert("orgMembers", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      joinedAt: now,
      updatedAt: now,
    });
  },
});

export const updateRole = mutation({
  args: {
    id: v.id("orgMembers"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const membership = await ctx.db.get(args.id);
    if (!membership) throw new Error("Membership not found");
    await ctx.db.patch(args.id, {
      role: args.role,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("orgMembers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
