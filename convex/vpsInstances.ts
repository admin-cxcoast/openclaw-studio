import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const instances = await ctx.db.query("vpsInstances").collect();
    const result = [];
    for (const vps of instances) {
      let orgName: string | null = null;
      if (vps.orgId) {
        const org = await ctx.db.get(vps.orgId);
        orgName = org?.name ?? null;
      }
      result.push({ ...vps, orgName });
    }
    return result;
  },
});

export const getByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return ctx.db
      .query("vpsInstances")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const upsertFromHostinger = mutation({
  args: {
    hostingerId: v.string(),
    hostname: v.string(),
    ipAddress: v.string(),
    region: v.optional(v.string()),
    plan: v.optional(v.string()),
    status: v.union(
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("unassigned"),
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("vpsInstances")
      .withIndex("by_hostingerId", (q) => q.eq("hostingerId", args.hostingerId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        hostname: args.hostname,
        ipAddress: args.ipAddress,
        region: args.region,
        plan: args.plan,
        status: args.status,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("vpsInstances", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const assignToOrg = mutation({
  args: {
    id: v.id("vpsInstances"),
    orgId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.id, {
      orgId: args.orgId,
      updatedAt: Date.now(),
    });
  },
});

export const updateTags = mutation({
  args: {
    id: v.id("vpsInstances"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.id, {
      tags: args.tags,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("vpsInstances") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
