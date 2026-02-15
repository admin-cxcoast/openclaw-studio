import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

// ── Super admin queries/mutations ─────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const assignments = await ctx.db.query("orgVpsAccess").collect();
    const result = [];
    for (const a of assignments) {
      const org = await ctx.db.get(a.orgId);
      const vps = await ctx.db.get(a.vpsId);
      const assignedByProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", a.assignedBy))
        .unique();
      result.push({
        ...a,
        orgName: org?.name ?? null,
        orgSlug: org?.slug ?? null,
        vpsHostname: vps?.hostname ?? null,
        vpsIp: vps?.ipAddress ?? null,
        assignedByName: assignedByProfile?.name ?? null,
      });
    }
    return result;
  },
});

export const assign = mutation({
  args: {
    orgId: v.id("organizations"),
    vpsId: v.id("vpsInstances"),
    maxInstances: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireSuperAdmin(ctx);

    const org = await ctx.db.get(args.orgId);
    if (!org) throw new Error("Organization not found");
    const vps = await ctx.db.get(args.vpsId);
    if (!vps) throw new Error("VPS not found");

    // Check uniqueness
    const existing = await ctx.db
      .query("orgVpsAccess")
      .withIndex("by_orgId_vpsId", (q) =>
        q.eq("orgId", args.orgId).eq("vpsId", args.vpsId),
      )
      .unique();
    if (existing) {
      throw new Error(
        `Organization "${org.name}" already has access to VPS "${vps.hostname}"`,
      );
    }

    if (args.maxInstances < 1) {
      throw new Error("maxInstances must be at least 1");
    }

    return ctx.db.insert("orgVpsAccess", {
      orgId: args.orgId,
      vpsId: args.vpsId,
      maxInstances: args.maxInstances,
      assignedBy: userId,
      assignedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("orgVpsAccess"),
    maxInstances: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Assignment not found");

    if (args.maxInstances < 1) {
      throw new Error("maxInstances must be at least 1");
    }

    await ctx.db.patch(args.id, { maxInstances: args.maxInstances });
  },
});

export const remove = mutation({
  args: { id: v.id("orgVpsAccess") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Assignment not found");

    // Check for active instances before removing access
    const activeInstances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId_orgId", (q) =>
        q.eq("vpsId", record.vpsId).eq("orgId", record.orgId),
      )
      .collect();

    const running = activeInstances.filter((i) => i.status === "running");
    if (running.length > 0) {
      throw new Error(
        `Cannot remove access: ${running.length} running instance(s) on this VPS`,
      );
    }

    await ctx.db.delete(args.id);
  },
});

// ── Org-scoped queries ───────────────────────────────────
// @deprecated — VPS is now abstracted from orgs. Auto-placement handles VPS selection.
// Kept for backward compatibility; no longer called from the deploy modal.

export const listByOrg = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) return [];
    if (orgRole === "viewer") return [];

    const assignments = await ctx.db
      .query("orgVpsAccess")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const result = [];
    for (const a of assignments) {
      const vps = await ctx.db.get(a.vpsId);
      if (!vps) continue;
      result.push({
        ...a,
        vpsHostname: vps.hostname,
        vpsIp: vps.ipAddress,
        vpsRegion: vps.region ?? null,
        vpsStatus: vps.status,
      });
    }
    return result;
  },
});

/** @deprecated — Use auto-placement via deployments.create instead. */
export const getAvailableVpsForOrg = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) return [];
    if (orgRole === "viewer") return [];

    const assignments = await ctx.db
      .query("orgVpsAccess")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const result = [];
    for (const a of assignments) {
      const vps = await ctx.db.get(a.vpsId);
      if (!vps || vps.status !== "running") continue;

      const instances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId_orgId", (q) =>
          q.eq("vpsId", a.vpsId).eq("orgId", orgId),
        )
        .collect();

      const used = instances.length;
      const remaining = a.maxInstances - used;

      if (remaining > 0) {
        result.push({
          vpsId: vps._id,
          hostname: vps.hostname,
          ipAddress: vps.ipAddress,
          region: vps.region ?? null,
          maxInstances: a.maxInstances,
          usedInstances: used,
          remaining,
        });
      }
    }

    return result;
  },
});
