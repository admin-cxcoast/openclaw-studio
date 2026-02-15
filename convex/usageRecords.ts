import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSuperAdmin, requireOrgAccess } from "./lib/authorization";

// ── Record usage from gateway (system-level, secret-validated) ──
// Gateway reports raw token counts; cost is calculated from model
// pricing stored in the `models` table (managed by super admin).

export const recordFromGateway = mutation({
  args: {
    provisionerSecret: v.string(),
    instanceId: v.id("gatewayInstances"),
    agentId: v.string(),
    modelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate provisioner secret
    const secretSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "provisioner_secret"))
      .unique();
    if (!secretSetting || secretSetting.value !== args.provisionerSecret) {
      throw new Error("Invalid provisioner secret");
    }

    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Instance not found");

    // Look up model pricing from the models table
    const models = await ctx.db
      .query("models")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .collect();
    const pricedModel = models.find(
      (m) => m.costPer1kInput != null && m.costPer1kOutput != null,
    ) ?? models[0];

    const costPer1kIn = pricedModel?.costPer1kInput ?? 0;
    const costPer1kOut = pricedModel?.costPer1kOutput ?? 0;

    // Cost in cents: (tokens / 1000) * $/1k * 100 cents/$
    const costCents = Math.round(
      ((args.inputTokens / 1000) * costPer1kIn +
        (args.outputTokens / 1000) * costPer1kOut) *
        100,
    );

    await ctx.db.insert("usageRecords", {
      orgId: instance.orgId,
      instanceId: args.instanceId,
      agentId: args.agentId,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costCents,
      period: args.period,
      reportedAt: Date.now(),
    });

    // Update the usageSummary LLM cost for this period
    const existing = await ctx.db
      .query("usageSummary")
      .withIndex("by_orgId_period", (q) =>
        q.eq("orgId", instance.orgId).eq("period", args.period),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        llmCostCents: existing.llmCostCents + costCents,
        totalCostCents: existing.totalCostCents + costCents,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("usageSummary", {
        orgId: instance.orgId,
        period: args.period,
        instanceCount: 0,
        agentCount: 0,
        infrastructureCostCents: 0,
        llmCostCents: costCents,
        overageCostCents: 0,
        totalCostCents: costCents,
        status: "current",
        updatedAt: Date.now(),
      });
    }

    return { costCents, modelPriced: costPer1kIn > 0 || costPer1kOut > 0 };
  },
});

// ── Org-facing: get usage records for a period ──

export const getByOrgPeriod = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    return ctx.db
      .query("usageRecords")
      .withIndex("by_orgId_period", (q) =>
        q.eq("orgId", orgId).eq("period", args.period),
      )
      .collect();
  },
});

// ── Org-facing: aggregated usage by model for a period ──

export const getAggregatedByModel = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_orgId_period", (q) =>
        q.eq("orgId", orgId).eq("period", args.period),
      )
      .collect();

    // Aggregate by modelId
    const byModel = new Map<
      string,
      { modelId: string; inputTokens: number; outputTokens: number; costCents: number; requestCount: number }
    >();

    for (const r of records) {
      const existing = byModel.get(r.modelId);
      if (existing) {
        existing.inputTokens += r.inputTokens;
        existing.outputTokens += r.outputTokens;
        existing.costCents += r.costCents;
        existing.requestCount += 1;
      } else {
        byModel.set(r.modelId, {
          modelId: r.modelId,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          costCents: r.costCents,
          requestCount: 1,
        });
      }
    }

    return Array.from(byModel.values()).sort((a, b) => b.costCents - a.costCents);
  },
});

// ── Super admin: usage records for an instance ──

export const getByInstance = query({
  args: { instanceId: v.id("gatewayInstances") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    return ctx.db
      .query("usageRecords")
      .withIndex("by_instanceId", (q) => q.eq("instanceId", args.instanceId))
      .collect();
  },
});
