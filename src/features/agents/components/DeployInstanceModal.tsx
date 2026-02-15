"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const INSTANCE_NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;

type Phase = "form" | "progress" | "done";

interface DeployInstanceModalProps {
  orgId: string;
  onClose: () => void;
}

export function DeployInstanceModal({ orgId, onClose }: DeployInstanceModalProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [deploymentId, setDeploymentId] = useState<Id<"deployments"> | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-lg rounded-xl p-6">
        {phase === "form" && (
          <ConfigForm
            orgId={orgId}
            onDeployStarted={(id) => {
              setDeploymentId(id);
              setPhase("progress");
            }}
            onClose={onClose}
          />
        )}
        {phase === "progress" && deploymentId && (
          <ProgressView
            deploymentId={deploymentId}
            onDone={() => setPhase("done")}
            onClose={onClose}
          />
        )}
        {phase === "done" && deploymentId && (
          <DoneView deploymentId={deploymentId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

// ── Phase 1: Config Form ────────────────────────────────

function ConfigForm({
  orgId,
  onDeployStarted,
  onClose,
}: {
  orgId: string;
  onDeployStarted: (id: Id<"deployments">) => void;
  onClose: () => void;
}) {
  const [instanceName, setInstanceName] = useState("");
  const [modelId, setModelId] = useState("claude-sonnet-4-5-20250929");
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedOrgId = orgId as Id<"organizations">;

  const availableSkills = useQuery(api.skills.listAvailable, {
    orgId: typedOrgId,
  });
  const createDeployment = useMutation(api.deployments.create);

  const nameValid = INSTANCE_NAME_RE.test(instanceName);
  const nameError = instanceName.length > 0 && !nameValid
    ? "Lowercase letters, numbers, hyphens. Must start with a letter (2-31 chars)."
    : null;

  const canSubmit = nameValid && modelId.trim() && !submitting;

  const handleToggleSkill = useCallback((skillId: string) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    try {
      const token = crypto.randomUUID();
      const depId = await createDeployment({
        orgId: typedOrgId,
        instanceName,
        config: {
          model: { primary: modelId, fallbacks: [] },
          skillIds: Array.from(selectedSkills) as Id<"skills">[],
          brainFiles: [],
          gatewayAuth: { mode: "token", token },
        },
      });

      // Fire-and-forget: trigger the SSH pipeline
      fetch("/api/org/provision-gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Studio-Request": "1",
        },
        body: JSON.stringify({ deploymentId: depId }),
      }).catch((fetchErr) => {
        console.error("[DeployInstanceModal] provision-gateway fetch error:", fetchErr);
      });

      onDeployStarted(depId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create deployment";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <h3 className="console-title mb-4 text-lg text-foreground">
        Deploy Instance
      </h3>

      <div className="flex flex-col gap-4">
        {/* Instance Name */}
        <div>
          <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Instance Name
          </label>
          <input
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="my-agent"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
          />
          {nameError && (
            <p className="mt-1 font-mono text-[10px] text-destructive">
              {nameError}
            </p>
          )}
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Primary Model
          </label>
          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="claude-sonnet-4-5-20250929"
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
          />
        </div>

        {/* Skills */}
        <div>
          <label className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Skills (optional)
          </label>
          {availableSkills === undefined ? (
            <p className="font-mono text-[10px] text-muted-foreground">Loading...</p>
          ) : availableSkills.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground">
              No skills available for your plan.
            </p>
          ) : (
            <div className="flex max-h-32 flex-col gap-1 overflow-auto rounded-md border border-border bg-surface-1 p-2">
              {availableSkills.map((skill) => (
                <label
                  key={skill._id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedSkills.has(skill._id)}
                    onChange={() => handleToggleSkill(skill._id)}
                    className="accent-primary"
                  />
                  <span className="font-mono text-[11px] text-foreground">
                    {skill.displayName}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {skill.category}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <p className="font-mono text-[10px] font-semibold text-destructive">
              Deployment Error
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-destructive">
              {error}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-md border border-transparent bg-primary px-4 py-1.5 font-mono text-xs font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
        >
          {submitting ? "Deploying..." : "Deploy"}
        </button>
      </div>
    </>
  );
}

// ── Phase 2: Progress ───────────────────────────────────

function ProgressView({
  deploymentId,
  onDone,
  onClose,
}: {
  deploymentId: Id<"deployments">;
  onDone: () => void;
  onClose: () => void;
}) {
  const deployment = useQuery(api.deployments.get, { id: deploymentId });

  useEffect(() => {
    if (!deployment) return;
    if (deployment.status === "running" || deployment.status === "failed" || deployment.status === "cancelled") {
      onDone();
    }
  }, [deployment?.status, onDone]);

  if (!deployment) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs text-muted-foreground">Loading deployment...</p>
      </div>
    );
  }

  return (
    <>
      <h3 className="console-title mb-1 text-lg text-foreground">
        Deploying: {deployment.instanceName}
      </h3>
      <p className="mb-4 font-mono text-[10px] text-muted-foreground">
        Provisioning gateway instance...
      </p>

      <div className="flex flex-col gap-2">
        {deployment.steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          Close (continues in background)
        </button>
      </div>
    </>
  );
}

function StepRow({ step }: { step: { id: string; name: string; status: string; error?: string } }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-4 text-center font-mono text-xs">
        {step.status === "success" && (
          <span className="text-green-500">&#10003;</span>
        )}
        {step.status === "failed" && (
          <span className="text-destructive">&#10007;</span>
        )}
        {step.status === "running" && (
          <span className="inline-block animate-spin text-primary">&#9696;</span>
        )}
        {(step.status === "pending" || step.status === "skipped") && (
          <span className="text-muted-foreground/40">&#9679;</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`font-mono text-xs ${
            step.status === "running"
              ? "text-foreground"
              : step.status === "success"
                ? "text-green-500"
                : step.status === "failed"
                  ? "text-destructive"
                  : "text-muted-foreground/60"
          }`}
        >
          {step.name}
        </p>
        {step.error && (
          <p className="mt-0.5 font-mono text-[10px] text-destructive">
            {step.error}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Phase 3: Done ───────────────────────────────────────

function DoneView({
  deploymentId,
  onClose,
}: {
  deploymentId: Id<"deployments">;
  onClose: () => void;
}) {
  const deployment = useQuery(api.deployments.get, { id: deploymentId });

  if (!deployment) {
    return null;
  }

  const isSuccess = deployment.status === "running";

  return (
    <>
      <h3 className="console-title mb-2 text-lg text-foreground">
        {isSuccess ? "Instance Deployed" : "Deployment Failed"}
      </h3>

      {isSuccess ? (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs text-muted-foreground">
            Gateway instance <strong className="text-foreground">{deployment.instanceName}</strong> is
            now running.
          </p>
          {deployment.port && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Port: <span className="text-foreground">{deployment.port}</span>
            </p>
          )}
          <p className="font-mono text-[10px] text-muted-foreground">
            Reload the page to connect to the new instance.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs text-destructive">
            {deployment.error ?? "An unknown error occurred during provisioning."}
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {deployment.steps
              .filter((s) => s.status === "failed")
              .map((s) => (
                <p key={s.id} className="font-mono text-[10px] text-destructive">
                  Step &quot;{s.name}&quot;: {s.error ?? "failed"}
                </p>
              ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-transparent bg-primary px-4 py-1.5 font-mono text-xs font-semibold text-primary-foreground transition hover:brightness-105"
        >
          Close
        </button>
      </div>
    </>
  );
}
