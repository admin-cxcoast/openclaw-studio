"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type OrgBillingPanelProps = {
  orgId: string;
};

export function OrgBillingPanel({ orgId }: OrgBillingPanelProps) {
  const usage = useQuery(api.billing.getOrgCurrentUsage, {
    orgId: orgId as Id<"organizations">,
  });
  const history = useQuery(api.billing.getOrgUsageHistory, {
    orgId: orgId as Id<"organizations">,
    limit: 6,
  });

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const modelUsage = useQuery(api.usageRecords.getAggregatedByModel, {
    orgId: orgId as Id<"organizations">,
    period,
  });

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const fmtTokens = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `${(n / 1_000).toFixed(1)}K`
        : String(n);

  if (usage === undefined) {
    return (
      <p className="font-mono text-xs text-muted-foreground">Loading...</p>
    );
  }

  if (!usage) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        No billing data available.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Plan + period */}
      <div className="flex items-center gap-3">
        <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-primary">
          {usage.planName}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {usage.period}
        </span>
      </div>

      {/* Resource usage */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Instances"
          value={`${usage.instanceCount}`}
          sub={`${usage.includedInstances} included`}
        />
        <Stat
          label="Agents"
          value={`${usage.agentCount}`}
          sub={`${usage.includedAgentsPerInstance}/instance included`}
        />
        <Stat label="Base" value={fmt(usage.monthlyBaseCents)} sub="Monthly" />
        <Stat
          label="Total"
          value={fmt(usage.totalCostCents)}
          sub="This month"
          bold
        />
      </div>

      {/* Cost breakdown */}
      <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cost Breakdown
        </p>
        <div className="flex flex-col gap-1">
          <CostRow label="Plan base" value={fmt(usage.monthlyBaseCents)} />
          <CostRow
            label="Infrastructure share"
            value={fmt(usage.infrastructureCostCents)}
          />
          <CostRow label="LLM usage" value={fmt(usage.llmCostCents)} />
          {usage.overageCostCents > 0 && (
            <CostRow
              label="Overage"
              value={fmt(usage.overageCostCents)}
              warn
            />
          )}
          <div className="mt-1 border-t border-border pt-1">
            <CostRow
              label="Total"
              value={fmt(usage.totalCostCents)}
              bold
            />
          </div>
        </div>
      </div>

      {/* Model usage breakdown */}
      {modelUsage && modelUsage.length > 0 && (
        <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            LLM Usage by Model
          </p>
          <div className="flex flex-col gap-1">
            {modelUsage.map((m) => (
              <div
                key={m.modelId}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-xs text-foreground">
                    {m.modelId}
                  </span>
                  <span className="ml-2 font-mono text-[9px] text-muted-foreground">
                    {fmtTokens(m.inputTokens)} in / {fmtTokens(m.outputTokens)}{" "}
                    out &middot; {m.requestCount} req
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {fmt(m.costCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Monthly History
          </p>
          <div className="flex flex-col gap-1">
            {history.map((h) => (
              <div
                key={h._id}
                className="flex items-center justify-between"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {h.period}
                </span>
                <div className="flex gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {h.instanceCount} inst &middot; {h.agentCount} agents
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {fmt(h.totalCostCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  bold,
}: {
  label: string;
  value: string;
  sub: string;
  bold?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-1 px-3 py-2">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm ${
          bold ? "font-bold text-primary" : "font-semibold text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="font-mono text-[8px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function CostRow({
  label,
  value,
  bold,
  warn,
}: {
  label: string;
  value: string;
  bold?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={`font-mono text-xs ${
          bold ? "font-semibold text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-xs ${
          bold
            ? "font-bold text-foreground"
            : warn
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
