import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

export const listPending = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId, orgRole } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to view proposals");
    }

    return ctx.db
      .query("knowledgeProposals")
      .withIndex("by_orgId_status", (q) =>
        q.eq("orgId", orgId).eq("status", "pending"),
      )
      .collect();
  },
});

export const listAll = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId, orgRole } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to view proposals");
    }

    const proposals = await ctx.db
      .query("knowledgeProposals")
      .withIndex("by_orgId_status", (q) => q.eq("orgId", orgId))
      .collect();

    return proposals.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Called by API routes on behalf of agents — no user session required.
 * Validates that the instanceId belongs to the orgId.
 */
export const createFromAgent = mutation({
  args: {
    orgId: v.id("organizations"),
    instanceId: v.id("gatewayInstances"),
    agentId: v.string(),
    key: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate instance belongs to org
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Gateway instance not found");
    if (instance.orgId !== args.orgId) {
      throw new Error("Instance does not belong to this organization");
    }

    return ctx.db.insert("knowledgeProposals", {
      orgId: args.orgId,
      instanceId: args.instanceId,
      agentId: args.agentId,
      key: args.key,
      content: args.content,
      tags: args.tags,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const approve = mutation({
  args: { id: v.id("knowledgeProposals") },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "pending") throw new Error("Proposal is not pending");

    const { userId, orgRole } = await requireOrgAccess(ctx, proposal.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to approve proposals");
    }

    // Update proposal status
    await ctx.db.patch(args.id, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });

    // Upsert into knowledge table
    const existing = await ctx.db
      .query("knowledge")
      .withIndex("by_orgId_key", (q) =>
        q.eq("orgId", proposal.orgId).eq("key", proposal.key),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: proposal.content,
        tags: proposal.tags,
        source: "agent" as const,
        sourceAgentId: proposal.agentId,
        sourceInstanceId: proposal.instanceId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("knowledge", {
        orgId: proposal.orgId,
        key: proposal.key,
        content: proposal.content,
        tags: proposal.tags,
        source: "agent",
        sourceAgentId: proposal.agentId,
        sourceInstanceId: proposal.instanceId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const reject = mutation({
  args: { id: v.id("knowledgeProposals") },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "pending") throw new Error("Proposal is not pending");

    const { userId, orgRole } = await requireOrgAccess(ctx, proposal.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to reject proposals");
    }

    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
  },
});
