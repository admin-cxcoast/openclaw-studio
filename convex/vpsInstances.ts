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
      // Count gateway instances on this VPS
      const gatewayInstances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId", (q) => q.eq("vpsId", vps._id))
        .collect();

      result.push({
        ...vps,
        instanceCount: gatewayInstances.length,
      });
    }
    return result;
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
      v.literal("unassigned"), // deprecated — kept for migration
    ),
    maxInstances: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("vpsInstances")
      .withIndex("by_hostingerId", (q) =>
        q.eq("hostingerId", args.hostingerId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        hostname: args.hostname,
        ipAddress: args.ipAddress,
        region: args.region,
        plan: args.plan,
        status: args.status,
        maxInstances: args.maxInstances ?? existing.maxInstances,
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

export const updateMaxInstances = mutation({
  args: {
    id: v.id("vpsInstances"),
    maxInstances: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch(args.id, {
      maxInstances: args.maxInstances,
      updatedAt: Date.now(),
    });
  },
});

export const updateVpsDetails = mutation({
  args: {
    id: v.id("vpsInstances"),
    ipAddress: v.optional(v.string()),
    sshUser: v.optional(v.string()),
    sshPort: v.optional(v.number()),
    maxInstances: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.ipAddress !== undefined) updates.ipAddress = fields.ipAddress;
    if (fields.sshUser !== undefined)
      updates.sshUser = fields.sshUser || undefined;
    if (fields.sshPort !== undefined)
      updates.sshPort = fields.sshPort || undefined;
    if (fields.maxInstances !== undefined)
      updates.maxInstances = fields.maxInstances || undefined;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("vpsInstances") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    // Check for existing gateway instances
    const gatewayInstances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", args.id))
      .collect();
    if (gatewayInstances.length > 0) {
      throw new Error(
        `Cannot delete VPS: ${gatewayInstances.length} gateway instance(s) still attached. Remove them first.`,
      );
    }
    await ctx.db.delete(args.id);
  },
});
