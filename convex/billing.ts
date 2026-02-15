import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

// ── Org-facing: current usage for the authenticated org ──

export const getOrgCurrentUsage = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return null;

    const org = await ctx.db.get(orgId);
    if (!org) return null;

    // Get org's gateway instances
    const instances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    const instanceCount = instances.length;
    const agentCount = instances.reduce(
      (sum, i) => sum + (i.agentCount ?? 1),
      0,
    );

    // Calculate infrastructure cost share
    let infrastructureCostCents = 0;
    for (const inst of instances) {
      const vps = await ctx.db.get(inst.vpsId);
      if (!vps?.monthlyCostCents) continue;

      // Count all instances on this VPS (all orgs)
      const allOnVps = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId", (q) => q.eq("vpsId", inst.vpsId))
        .collect();
      const totalOnVps = allOnVps.length || 1;

      // Org's share = their instances on this VPS / total instances * VPS cost
      const orgOnVps = allOnVps.filter((i) => i.orgId === orgId).length;
      infrastructureCostCents += Math.round(
        (orgOnVps / totalOnVps) * vps.monthlyCostCents,
      );
    }

    // Get plan definition for overage calculation
    const planDef = await ctx.db
      .query("planDefinitions")
      .withIndex("by_plan", (q) => q.eq("plan", org.plan))
      .unique();

    let overageCostCents = 0;
    if (planDef) {
      const extraInstances = Math.max(
        0,
        instanceCount - planDef.includedInstances,
      );
      const extraAgents = Math.max(
        0,
        agentCount - instanceCount * planDef.includedAgentsPerInstance,
      );
      overageCostCents =
        extraInstances * planDef.overagePerInstanceCents +
        extraAgents * planDef.overagePerAgentCents;
    }

    // LLM costs: aggregate directly from usage records for accuracy
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usageRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_orgId_period", (q) =>
        q.eq("orgId", orgId).eq("period", period),
      )
      .collect();
    const llmCostCents = usageRecords.reduce(
      (sum, r) => sum + r.costCents,
      0,
    );

    const totalCostCents =
      (planDef?.monthlyBaseCents ?? 0) +
      overageCostCents +
      llmCostCents;

    return {
      plan: org.plan,
      planName: planDef?.displayName ?? org.plan,
      period,
      instanceCount,
      agentCount,
      includedInstances: planDef?.includedInstances ?? 0,
      includedAgentsPerInstance: planDef?.includedAgentsPerInstance ?? 0,
      monthlyBaseCents: planDef?.monthlyBaseCents ?? 0,
      infrastructureCostCents,
      llmCostCents,
      overageCostCents,
      totalCostCents,
    };
  },
});

export const getOrgUsageHistory = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const summaries = await ctx.db
      .query("usageSummary")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    return summaries
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, args.limit ?? 6);
  },
});

// ── Super admin: global cost overview ────────────────────

export const getGlobalCostSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const allVps = await ctx.db.query("vpsInstances").collect();
    const totalVpsCostCents = allVps.reduce(
      (sum, v) => sum + (v.monthlyCostCents ?? 0),
      0,
    );

    const orgs = await ctx.db.query("organizations").collect();
    const activeOrgs = orgs.filter((o) => o.status === "active");

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalOrgCostCents = 0;
    let totalLlmCostCents = 0;
    const perOrg: Array<{
      orgId: string;
      orgName: string;
      plan: string;
      instanceCount: number;
      agentCount: number;
      infrastructureCostCents: number;
      llmCostCents: number;
      totalCostCents: number;
    }> = [];

    for (const org of activeOrgs) {
      const instances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_orgId", (q) => q.eq("orgId", org._id))
        .collect();

      const instanceCount = instances.length;
      const agentCount = instances.reduce(
        (sum, i) => sum + (i.agentCount ?? 1),
        0,
      );

      // Infrastructure share
      let infraCost = 0;
      for (const inst of instances) {
        const vps = await ctx.db.get(inst.vpsId);
        if (!vps?.monthlyCostCents) continue;
        const allOnVps = await ctx.db
          .query("gatewayInstances")
          .withIndex("by_vpsId", (q) => q.eq("vpsId", inst.vpsId))
          .collect();
        const totalOnVps = allOnVps.length || 1;
        const orgOnVps = allOnVps.filter(
          (i) => i.orgId === org._id,
        ).length;
        infraCost += Math.round(
          (orgOnVps / totalOnVps) * vps.monthlyCostCents,
        );
      }

      const orgUsageRecords = await ctx.db
        .query("usageRecords")
        .withIndex("by_orgId_period", (q) =>
          q.eq("orgId", org._id).eq("period", period),
        )
        .collect();
      const llmCost = orgUsageRecords.reduce(
        (sum, r) => sum + r.costCents,
        0,
      );

      const planDef = await ctx.db
        .query("planDefinitions")
        .withIndex("by_plan", (q) => q.eq("plan", org.plan))
        .unique();

      const baseCost = planDef?.monthlyBaseCents ?? 0;
      const orgTotal = baseCost + infraCost + llmCost;

      totalOrgCostCents += orgTotal;
      totalLlmCostCents += llmCost;

      if (instanceCount > 0) {
        perOrg.push({
          orgId: org._id,
          orgName: org.name,
          plan: org.plan,
          instanceCount,
          agentCount,
          infrastructureCostCents: infraCost,
          llmCostCents: llmCost,
          totalCostCents: orgTotal,
        });
      }
    }

    return {
      period,
      totalVpsCostCents,
      totalOrgCostCents,
      totalLlmCostCents,
      marginCents: totalOrgCostCents - totalVpsCostCents,
      perOrg: perOrg.sort((a, b) => b.totalCostCents - a.totalCostCents),
    };
  },
});

// ── Internal: snapshot monthly usage (called from scheduled job) ──

export const _snapshotMonthlyUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const orgs = await ctx.db.query("organizations").collect();
    let snapshotted = 0;

    for (const org of orgs.filter((o) => o.status === "active")) {
      const instances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_orgId", (q) => q.eq("orgId", org._id))
        .collect();

      if (instances.length === 0) continue;

      const instanceCount = instances.length;
      const agentCount = instances.reduce(
        (sum, i) => sum + (i.agentCount ?? 1),
        0,
      );

      // Calculate infrastructure cost share
      let infraCost = 0;
      for (const inst of instances) {
        const vps = await ctx.db.get(inst.vpsId);
        if (!vps?.monthlyCostCents) continue;
        const allOnVps = await ctx.db
          .query("gatewayInstances")
          .withIndex("by_vpsId", (q) => q.eq("vpsId", inst.vpsId))
          .collect();
        const totalOnVps = allOnVps.length || 1;
        const orgOnVps = allOnVps.filter(
          (i) => i.orgId === org._id,
        ).length;
        infraCost += Math.round(
          (orgOnVps / totalOnVps) * vps.monthlyCostCents,
        );
      }

      // Overage
      const planDef = await ctx.db
        .query("planDefinitions")
        .withIndex("by_plan", (q) => q.eq("plan", org.plan))
        .unique();

      let overageCost = 0;
      if (planDef) {
        const extraInstances = Math.max(
          0,
          instanceCount - planDef.includedInstances,
        );
        const extraAgents = Math.max(
          0,
          agentCount - instanceCount * planDef.includedAgentsPerInstance,
        );
        overageCost =
          extraInstances * planDef.overagePerInstanceCents +
          extraAgents * planDef.overagePerAgentCents;
      }

      // LLM costs from existing summary
      const existing = await ctx.db
        .query("usageSummary")
        .withIndex("by_orgId_period", (q) =>
          q.eq("orgId", org._id).eq("period", period),
        )
        .unique();
      const llmCost = existing?.llmCostCents ?? 0;

      const totalCost =
        (planDef?.monthlyBaseCents ?? 0) + overageCost + llmCost;

      if (existing) {
        await ctx.db.patch(existing._id, {
          instanceCount,
          agentCount,
          infrastructureCostCents: infraCost,
          overageCostCents: overageCost,
          totalCostCents: totalCost,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("usageSummary", {
          orgId: org._id,
          period,
          instanceCount,
          agentCount,
          infrastructureCostCents: infraCost,
          llmCostCents: llmCost,
          overageCostCents: overageCost,
          totalCostCents: totalCost,
          status: "current",
          updatedAt: Date.now(),
        });
      }

      snapshotted++;
    }

    return { period, snapshotted };
  },
});
