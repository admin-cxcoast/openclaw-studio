"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function BillingPage() {
  const summary = useQuery(api.billing.getGlobalCostSummary);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="console-title text-2xl text-foreground">Billing</h1>
        {summary && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Period: {summary.period}
          </p>
        )}
      </div>

      {summary === undefined ? (
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
      ) : (
        <>
          {/* KPI cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="VPS Spend"
              value={formatCents(summary.totalVpsCostCents)}
              sub="Hostinger monthly"
            />
            <KpiCard
              label="Org Revenue"
              value={formatCents(summary.totalOrgCostCents)}
              sub="Plan base + overage + LLM"
            />
            <KpiCard
              label="LLM Costs"
              value={formatCents(summary.totalLlmCostCents)}
              sub="Token usage"
            />
            <KpiCard
              label="Margin"
              value={formatCents(summary.marginCents)}
              sub="Revenue - VPS"
              accent={summary.marginCents >= 0}
            />
          </div>

          {/* Per-org breakdown */}
          {summary.perOrg.length === 0 ? (
            <div className="rounded-md border border-border bg-surface-1 px-6 py-8 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                No organizations with active instances.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface-1">
                    <Th>Organization</Th>
                    <Th>Plan</Th>
                    <Th align="right">Instances</Th>
                    <Th align="right">Agents</Th>
                    <Th align="right">Infra</Th>
                    <Th align="right">LLM</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perOrg.map((org) => (
                    <tr
                      key={org.orgId}
                      className="border-b border-border/50 last:border-0"
                    >
                      <Td>{org.orgName}</Td>
                      <Td>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase">
                          {org.plan}
                        </span>
                      </Td>
                      <Td align="right">{org.instanceCount}</Td>
                      <Td align="right">{org.agentCount}</Td>
                      <Td align="right">
                        {formatCents(org.infrastructureCostCents)}
                      </Td>
                      <Td align="right">
                        {formatCents(org.llmCostCents)}
                      </Td>
                      <Td align="right" bold>
                        {formatCents(org.totalCostCents)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-1 px-4 py-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg font-bold ${
          accent === false
            ? "text-destructive"
            : accent === true
              ? "text-primary"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
        {sub}
      </p>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  bold,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 font-mono text-xs ${
        align === "right" ? "text-right" : "text-left"
      } ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}
    >
      {children}
    </td>
  );
}
