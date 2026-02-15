"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const DEFAULT_PLANS = [
  { plan: "free", displayName: "Free" },
  { plan: "starter", displayName: "Starter" },
  { plan: "pro", displayName: "Pro" },
  { plan: "enterprise", displayName: "Enterprise" },
];

export default function PlansPage() {
  const plans = useQuery(api.planDefinitions.list);
  const upsert = useMutation(api.planDefinitions.upsert);
  const remove = useMutation(api.planDefinitions.remove);

  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    plan: "",
    displayName: "",
    monthlyBaseCents: 0,
    includedInstances: 1,
    includedAgentsPerInstance: 1,
    overagePerInstanceCents: 0,
    overagePerAgentCents: 0,
    llmMarkupPercent: 0,
    isActive: true,
  });

  const handleEdit = (plan: typeof plans extends (infer T)[] | undefined ? T : never) => {
    if (!plan) return;
    setEditingPlan(plan.plan);
    setFormData({
      plan: plan.plan,
      displayName: plan.displayName,
      monthlyBaseCents: plan.monthlyBaseCents,
      includedInstances: plan.includedInstances,
      includedAgentsPerInstance: plan.includedAgentsPerInstance,
      overagePerInstanceCents: plan.overagePerInstanceCents,
      overagePerAgentCents: plan.overagePerAgentCents,
      llmMarkupPercent: plan.llmMarkupPercent ?? 0,
      isActive: plan.isActive,
    });
  };

  const handleNew = (preset?: { plan: string; displayName: string }) => {
    setEditingPlan("__new__");
    setFormData({
      plan: preset?.plan ?? "",
      displayName: preset?.displayName ?? "",
      monthlyBaseCents: 0,
      includedInstances: 1,
      includedAgentsPerInstance: 1,
      overagePerInstanceCents: 0,
      overagePerAgentCents: 0,
      llmMarkupPercent: 0,
      isActive: true,
    });
  };

  const handleSave = async () => {
    await upsert({
      plan: formData.plan,
      displayName: formData.displayName,
      monthlyBaseCents: formData.monthlyBaseCents,
      includedInstances: formData.includedInstances,
      includedAgentsPerInstance: formData.includedAgentsPerInstance,
      overagePerInstanceCents: formData.overagePerInstanceCents,
      overagePerAgentCents: formData.overagePerAgentCents,
      llmMarkupPercent: formData.llmMarkupPercent || undefined,
      isActive: formData.isActive,
    });
    setEditingPlan(null);
  };

  const formatCents = (cents: number) =>
    `$${(cents / 100).toFixed(2)}`;

  const existingPlanNames = new Set((plans ?? []).map((p) => p.plan));
  const missingPlans = DEFAULT_PLANS.filter(
    (d) => !existingPlanNames.has(d.plan),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">
          Plan Pricing
        </h1>
        <button
          type="button"
          onClick={() => handleNew()}
          className="rounded-md bg-primary px-3 py-1.5 font-mono text-xs font-semibold text-primary-foreground transition hover:brightness-105"
        >
          New Plan
        </button>
      </div>

      {missingPlans.length > 0 && (
        <div className="mb-4 rounded-md border border-border/50 bg-surface-1 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Add
          </p>
          <div className="flex flex-wrap gap-2">
            {missingPlans.map((preset) => (
              <button
                key={preset.plan}
                type="button"
                onClick={() => handleNew(preset)}
                className="rounded-md border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:bg-surface-2"
              >
                + {preset.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {plans === undefined ? (
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
      ) : plans.length === 0 && !editingPlan ? (
        <div className="rounded-md border border-border bg-surface-1 px-6 py-8 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            No plan definitions yet. Click &quot;New Plan&quot; or use Quick Add above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className="rounded-md border border-border bg-surface-1 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {plan.displayName}
                    <span className="ml-2 text-muted-foreground">
                      ({plan.plan})
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {formatCents(plan.monthlyBaseCents)}/mo &middot;{" "}
                    {plan.includedInstances} instance{plan.includedInstances !== 1 ? "s" : ""} &middot;{" "}
                    {plan.includedAgentsPerInstance} agent{plan.includedAgentsPerInstance !== 1 ? "s" : ""}/inst &middot;{" "}
                    {plan.isActive ? "Active" : "Inactive"}
                  </p>
                  {(plan.overagePerInstanceCents > 0 || plan.overagePerAgentCents > 0) && (
                    <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      Overage: {formatCents(plan.overagePerInstanceCents)}/extra instance,{" "}
                      {formatCents(plan.overagePerAgentCents)}/extra agent
                      {plan.llmMarkupPercent ? ` · ${plan.llmMarkupPercent}% LLM markup` : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(plan)}
                    className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition hover:bg-surface-2"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove({ id: plan._id as Id<"planDefinitions"> })}
                    className="rounded border border-destructive/30 px-2 py-1 font-mono text-[10px] text-destructive transition hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create modal */}
      {editingPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingPlan(null);
          }}
        >
          <div className="glass-panel w-full max-w-md rounded-xl p-6">
            <h3 className="console-title mb-4 text-lg text-foreground">
              {editingPlan === "__new__" ? "New Plan" : `Edit: ${formData.displayName}`}
            </h3>

            <div className="flex flex-col gap-3">
              <Field
                label="Plan ID"
                value={formData.plan}
                onChange={(v) => setFormData((f) => ({ ...f, plan: v }))}
                disabled={editingPlan !== "__new__"}
                placeholder="e.g. starter"
              />
              <Field
                label="Display Name"
                value={formData.displayName}
                onChange={(v) => setFormData((f) => ({ ...f, displayName: v }))}
                placeholder="e.g. Starter"
              />
              <NumberField
                label="Monthly Base (cents)"
                value={formData.monthlyBaseCents}
                onChange={(v) => setFormData((f) => ({ ...f, monthlyBaseCents: v }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Included Instances"
                  value={formData.includedInstances}
                  onChange={(v) => setFormData((f) => ({ ...f, includedInstances: v }))}
                />
                <NumberField
                  label="Agents / Instance"
                  value={formData.includedAgentsPerInstance}
                  onChange={(v) => setFormData((f) => ({ ...f, includedAgentsPerInstance: v }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Overage / Instance (cents)"
                  value={formData.overagePerInstanceCents}
                  onChange={(v) => setFormData((f) => ({ ...f, overagePerInstanceCents: v }))}
                />
                <NumberField
                  label="Overage / Agent (cents)"
                  value={formData.overagePerAgentCents}
                  onChange={(v) => setFormData((f) => ({ ...f, overagePerAgentCents: v }))}
                />
              </div>
              <NumberField
                label="LLM Markup %"
                value={formData.llmMarkupPercent}
                onChange={(v) => setFormData((f) => ({ ...f, llmMarkupPercent: v }))}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, isActive: e.target.checked }))
                  }
                  className="accent-primary"
                />
                <span className="font-mono text-[10px] text-foreground">Active</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.plan.trim() || !formData.displayName.trim()}
                className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-foreground focus:border-ring focus:outline-none"
      />
    </div>
  );
}
