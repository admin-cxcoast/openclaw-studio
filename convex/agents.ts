import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

// Hard cap: max agents per gateway instance (Node.js single-process limit)
// Based on ~1 GB base + ~150 MB per additional agent within ~2 GB heap
const MAX_AGENTS_PER_INSTANCE = 5;

// ── Validate that the org can create another agent ──────

export const requestCreate = mutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    instanceId: v.id("gatewayInstances"),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) throw new Error("Organization required");
    if (orgRole === "viewer") {
      throw new Error("Viewer role cannot create agents");
    }

    // Verify instance belongs to this org
    const instance = await ctx.db.get(args.instanceId);
    if (!instance || instance.orgId !== orgId) {
      throw new Error("Instance not found or not accessible");
    }

    // Check org-level maxAgents quota
    const org = await ctx.db.get(orgId);
    if (org?.settings?.maxAgents) {
      const allInstances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
        .collect();
      const totalAgents = allInstances.reduce(
        (sum, i) => sum + (i.agentCount ?? 1),
        0,
      );
      if (totalAgents >= org.settings.maxAgents) {
        throw new Error(
          `Agent limit reached: ${totalAgents}/${org.settings.maxAgents}`,
        );
      }
    }

    // Hard cap: max agents per instance (Node.js process limit)
    const currentAgents = instance.agentCount ?? 1;
    if (currentAgents >= MAX_AGENTS_PER_INSTANCE) {
      throw new Error(
        `Instance agent limit reached: ${currentAgents}/${MAX_AGENTS_PER_INSTANCE}. Deploy a new instance for additional agents.`,
      );
    }

    return {
      approved: true,
      instanceId: args.instanceId,
      agentName: args.agentName,
    };
  },
});

// ── Confirm agent was created on gateway (increment count) ─

export const confirmCreate = mutation({
  args: {
    instanceId: v.id("gatewayInstances"),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Instance not found");

    await requireOrgAccess(ctx, instance.orgId);

    const currentCount = instance.agentCount ?? 1;
    await ctx.db.patch(args.instanceId, {
      agentCount: currentCount + 1,
      updatedAt: Date.now(),
    });
  },
});

// ── Confirm agent was removed on gateway (decrement count) ─

export const confirmRemove = mutation({
  args: {
    instanceId: v.id("gatewayInstances"),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Instance not found");

    await requireOrgAccess(ctx, instance.orgId);

    const currentCount = instance.agentCount ?? 1;
    await ctx.db.patch(args.instanceId, {
      agentCount: Math.max(0, currentCount - 1),
      updatedAt: Date.now(),
    });
  },
});

// ── Query agent count for an instance ───────────────────

export const getInstanceAgentCount = query({
  args: { instanceId: v.id("gatewayInstances") },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) return null;

    await requireOrgAccess(ctx, instance.orgId);

    return {
      instanceId: args.instanceId,
      agentCount: instance.agentCount ?? 1,
    };
  },
});
