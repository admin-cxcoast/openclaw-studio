import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

// ── Admin queries/mutations ─────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const instances = await ctx.db.query("gatewayInstances").collect();
    const result = [];
    for (const inst of instances) {
      const vps = await ctx.db.get(inst.vpsId);
      const org = await ctx.db.get(inst.orgId);
      result.push({
        ...inst,
        token: inst.token ? "********" : undefined,
        vpsHostname: vps?.hostname ?? null,
        vpsIp: vps?.ipAddress ?? null,
        orgName: org?.name ?? null,
      });
    }
    return result;
  },
});

export const listByVps = query({
  args: { vpsId: v.id("vpsInstances") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const instances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", args.vpsId))
      .collect();
    const result = [];
    for (const inst of instances) {
      const org = await ctx.db.get(inst.orgId);
      result.push({
        ...inst,
        token: inst.token ? "********" : undefined,
        orgName: org?.name ?? null,
      });
    }
    return result;
  },
});

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const instances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const result = [];
    for (const inst of instances) {
      const vps = await ctx.db.get(inst.vpsId);
      result.push({
        ...inst,
        token: inst.token ? "********" : undefined,
        vpsHostname: vps?.hostname ?? null,
        vpsIp: vps?.ipAddress ?? null,
      });
    }
    return result;
  },
});

export const create = mutation({
  args: {
    vpsId: v.id("vpsInstances"),
    orgId: v.id("organizations"),
    name: v.string(),
    port: v.number(),
    token: v.optional(v.string()),
    url: v.optional(v.string()),
    stateDir: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("stopped"),
        v.literal("error"),
        v.literal("unknown"),
      ),
    ),
    agentCount: v.optional(v.number()),
    primaryAgentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const vps = await ctx.db.get(args.vpsId);
    if (!vps) throw new Error("VPS not found");

    // Check capacity
    const existing = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", args.vpsId))
      .collect();

    // Only enforce capacity if maxInstances was explicitly configured
    if (vps.maxInstances && existing.length >= vps.maxInstances) {
      throw new Error(
        `VPS ${vps.hostname} is at capacity (${existing.length}/${vps.maxInstances})`,
      );
    }

    // Check port conflict on same VPS
    const portConflict = existing.find((i) => i.port === args.port);
    if (portConflict) {
      throw new Error(
        `Port ${args.port} already in use on ${vps.hostname}`,
      );
    }

    const { status: statusArg, agentCount, primaryAgentName, ...rest } = args;
    return ctx.db.insert("gatewayInstances", {
      ...rest,
      status: statusArg ?? "unknown",
      agentCount,
      primaryAgentName,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("gatewayInstances"),
    name: v.optional(v.string()),
    port: v.optional(v.number()),
    token: v.optional(v.string()),
    url: v.optional(v.string()),
    stateDir: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("stopped"),
        v.literal("error"),
        v.literal("unknown"),
      ),
    ),
    orgId: v.optional(v.id("organizations")),
    agentCount: v.optional(v.number()),
    primaryAgentName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, ...fields } = args;
    const inst = await ctx.db.get(id);
    if (!inst) throw new Error("Gateway instance not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.agentCount !== undefined) updates.agentCount = fields.agentCount;
    if (fields.primaryAgentName !== undefined) updates.primaryAgentName = fields.primaryAgentName;
    if (fields.port !== undefined) {
      // Check port conflict on same VPS
      const siblings = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId", (q) => q.eq("vpsId", inst.vpsId))
        .collect();
      const conflict = siblings.find(
        (s) => s._id !== id && s.port === fields.port,
      );
      if (conflict) {
        throw new Error(`Port ${fields.port} already in use on this VPS`);
      }
      updates.port = fields.port;
    }
    if (fields.token !== undefined && fields.token !== "********") {
      updates.token = fields.token || undefined;
    }
    if (fields.url !== undefined) updates.url = fields.url || undefined;
    if (fields.stateDir !== undefined)
      updates.stateDir = fields.stateDir || undefined;
    if (fields.status !== undefined) updates.status = fields.status;
    if (fields.orgId !== undefined) updates.orgId = fields.orgId;

    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("gatewayInstances") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ── User-facing query ───────────────────────────────────

export const getMyGateways = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return null;

    const org = await ctx.db.get(orgId);
    if (!org) return null;

    const instances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const result = [];
    for (const inst of instances) {
      const vps = await ctx.db.get(inst.vpsId);
      if (!vps) continue;

      const gatewayUrl = inst.url ?? `ws://${vps.ipAddress || vps.hostname}:${inst.port}`;
      result.push({
        instanceId: inst._id,
        name: inst.name,
        primaryAgentName: inst.primaryAgentName ?? null,
        gatewayUrl,
        token: inst.token ?? null,
        status: inst.status,
        vpsHostname: vps.hostname,
        vpsIp: vps.ipAddress,
        port: inst.port,
        sshUser: vps.sshUser ?? "root",
        sshPort: vps.sshPort ?? 22,
      });
    }

    // Sort: running first
    result.sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (a.status !== "running" && b.status === "running") return 1;
      return 0;
    });

    return { org: { name: org.name, slug: org.slug }, gateways: result };
  },
});

