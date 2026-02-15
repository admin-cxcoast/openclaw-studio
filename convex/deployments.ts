import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Instance name validation — ported from Agency-AI validation.ts
const INSTANCE_NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;

// Docker deployment steps — mirrors Agency-AI deployment-runner.ts
const DOCKER_STEPS = [
  { id: "provision", name: "Provisioning config" },
  { id: "push-config", name: "Pushing config to VPS" },
  { id: "start-container", name: "Starting container" },
  { id: "fix-permissions", name: "Fixing permissions" },
  { id: "deploy-workspace", name: "Deploying workspace" },
  { id: "health", name: "Verifying gateway health" },
];

// ── Queries ───────────────────────────────────────────────

export const get = query({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) return null;
    const { profile } = await requireOrgAccess(ctx, dep.orgId);

    // Strip sensitive auth token for non-superAdmin (vpsId kept — it's an opaque ID)
    if (profile.role !== "superAdmin") {
      const { config, ...safe } = dep;
      const { gatewayAuth: _auth, ...safeConfig } = config;
      return { ...safe, config: safeConfig } as typeof dep;
    }
    return dep;
  },
});

export const list = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const deps = await ctx.db
      .query("deployments")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    return deps.sort((a, b) => b.startedAt - a.startedAt);
  },
});

export const listActive = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const queued = await ctx.db
      .query("deployments")
      .withIndex("by_orgId_status", (q) =>
        q.eq("orgId", orgId).eq("status", "queued"),
      )
      .collect();

    const provisioning = await ctx.db
      .query("deployments")
      .withIndex("by_orgId_status", (q) =>
        q.eq("orgId", orgId).eq("status", "provisioning"),
      )
      .collect();

    return [...queued, ...provisioning].sort(
      (a, b) => b.startedAt - a.startedAt,
    );
  },
});

/** System-level query for the provisioner — validates secret, returns full deployment data. */
export const getForSystem = query({
  args: {
    provisionerSecret: v.string(),
    id: v.id("deployments"),
  },
  handler: async (ctx, args) => {
    const secretSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key", (q) => q.eq("key", "provisioner_secret"))
      .unique();
    if (
      !secretSetting ||
      secretSetting.value !== args.provisionerSecret
    ) {
      throw new Error("Invalid provisioner secret");
    }
    return ctx.db.get(args.id);
  },
});

// ── Auto-placement: find VPS with most remaining capacity ─

async function selectBestVps(
  ctx: MutationCtx,
): Promise<Id<"vpsInstances"> | null> {
  const allVps = await ctx.db.query("vpsInstances").collect();
  const running = allVps.filter((v) => v.status === "running");
  if (running.length === 0) return null;

  let bestId: Id<"vpsInstances"> | null = null;
  let bestRemaining = -1;

  for (const vps of running) {
    if (!vps.maxInstances) continue; // skip VPS without capacity configured

    // Count existing gateway instances on this VPS
    const instances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", vps._id))
      .collect();

    // Count in-flight deployments targeting this VPS
    const queuedDeps = await ctx.db
      .query("deployments")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", vps._id))
      .collect();
    const inFlight = queuedDeps.filter(
      (d) => d.status === "queued" || d.status === "provisioning",
    ).length;

    const remaining = vps.maxInstances - instances.length - inFlight;
    if (remaining > bestRemaining) {
      bestRemaining = remaining;
      bestId = vps._id;
    }
  }

  return bestRemaining > 0 ? bestId : null;
}

// ── Create deployment (org admin+) ────────────────────────

export const create = mutation({
  args: {
    orgId: v.optional(v.id("organizations")),
    vpsId: v.optional(v.id("vpsInstances")),
    instanceName: v.string(),
    config: v.object({
      model: v.object({
        primary: v.string(),
        fallbacks: v.array(v.string()),
      }),
      skillIds: v.array(v.id("skills")),
      brainFiles: v.array(
        v.object({ name: v.string(), content: v.string() }),
      ),
      roleTemplate: v.optional(v.string()),
      agentIdentity: v.optional(
        v.object({
          name: v.string(),
          email: v.optional(v.string()),
          gender: v.optional(v.string()),
        }),
      ),
      gatewayAuth: v.object({
        mode: v.literal("token"),
        token: v.string(),
      }),
    }),
  },
  handler: async (ctx, args) => {
    const { userId, orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) throw new Error("Organization required");
    if (orgRole === "viewer" || orgRole === "member") {
      throw new Error("Admin access required to deploy instances");
    }

    // 1. Validate instance name
    if (!INSTANCE_NAME_RE.test(args.instanceName)) {
      throw new Error(
        `Invalid instance name: must match /^[a-z][a-z0-9-]{1,30}$/`,
      );
    }

    // 2. Resolve VPS — auto-place if not specified
    let resolvedVpsId: Id<"vpsInstances">;
    if (args.vpsId) {
      // Legacy / superAdmin override path — validate access
      const access = await ctx.db
        .query("orgVpsAccess")
        .withIndex("by_orgId_vpsId", (q) =>
          q.eq("orgId", orgId).eq("vpsId", args.vpsId!),
        )
        .unique();
      if (!access) {
        throw new Error("Organization does not have access to this VPS");
      }
      const orgVpsInstances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId_orgId", (q) =>
          q.eq("vpsId", args.vpsId!).eq("orgId", orgId),
        )
        .collect();
      if (orgVpsInstances.length >= access.maxInstances) {
        throw new Error(
          `VPS quota exceeded: ${orgVpsInstances.length}/${access.maxInstances} instances used`,
        );
      }
      resolvedVpsId = args.vpsId;
    } else {
      // SaaS path — auto-select VPS with most capacity
      const bestVps = await selectBestVps(ctx);
      if (!bestVps) {
        throw new Error("No capacity available. Please try again later.");
      }
      resolvedVpsId = bestVps;
    }

    // 3. Check global VPS capacity
    const vps = await ctx.db.get(resolvedVpsId);
    if (!vps) throw new Error("VPS not found");
    if (vps.maxInstances) {
      const allOnVps = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId", (q) => q.eq("vpsId", resolvedVpsId))
        .collect();
      const pendingOnVps = await ctx.db
        .query("deployments")
        .withIndex("by_vpsId", (q) => q.eq("vpsId", resolvedVpsId))
        .collect();
      const inFlight = pendingOnVps.filter(
        (d) => d.status === "queued" || d.status === "provisioning",
      ).length;
      if (allOnVps.length + inFlight >= vps.maxInstances) {
        throw new Error("No capacity available. Please try again later.");
      }
    }

    // 4. Check org-level maxInstances (if set)
    const org = await ctx.db.get(orgId);
    if (org?.settings?.maxInstances) {
      const allOrgInstances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
        .collect();
      if (allOrgInstances.length >= org.settings.maxInstances) {
        throw new Error(
          `Instance limit reached: ${allOrgInstances.length}/${org.settings.maxInstances}`,
        );
      }
    }

    // 5. Check name uniqueness on the resolved VPS
    const allVpsInstances = await ctx.db
      .query("gatewayInstances")
      .withIndex("by_vpsId", (q) => q.eq("vpsId", resolvedVpsId))
      .collect();
    const nameConflict = allVpsInstances.find(
      (i) => i.name === args.instanceName,
    );
    if (nameConflict) {
      throw new Error(
        `Instance name "${args.instanceName}" is already in use`,
      );
    }

    // 6. Initialize deployment with Docker steps
    const steps = DOCKER_STEPS.map((s) => ({
      ...s,
      status: "pending" as const,
    }));

    return ctx.db.insert("deployments", {
      orgId,
      vpsId: resolvedVpsId,
      instanceName: args.instanceName,
      config: args.config,
      status: "queued",
      steps,
      createdBy: userId,
      startedAt: Date.now(),
    });
  },
});

// ── Cancel (only if queued) ───────────────────────────────

export const cancel = mutation({
  args: { id: v.id("deployments") },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) throw new Error("Deployment not found");

    const { orgRole } = await requireOrgAccess(ctx, dep.orgId);
    if (orgRole === "viewer" || orgRole === "member") {
      throw new Error("Admin access required to cancel deployments");
    }

    if (dep.status !== "queued") {
      throw new Error(`Cannot cancel deployment in "${dep.status}" state`);
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      completedAt: Date.now(),
      steps: dep.steps.map((s) => ({
        ...s,
        status: s.status === "pending" ? ("skipped" as const) : s.status,
      })),
    });
  },
});

// ── System mutations (called from API routes via ConvexHttpClient) ─────

export const updateStep = mutation({
  args: {
    id: v.id("deployments"),
    stepId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) throw new Error("Deployment not found");

    const now = Date.now();
    const steps = dep.steps.map((s) => {
      if (s.id !== args.stepId) return s;
      return {
        ...s,
        status: args.status,
        ...(args.status === "running" && !s.startedAt
          ? { startedAt: now }
          : {}),
        ...((args.status === "success" || args.status === "failed")
          ? { completedAt: now }
          : {}),
        ...(args.error ? { error: args.error } : {}),
      };
    });

    // If a step is running, deployment status should be provisioning
    const deploymentStatus =
      args.status === "running" && dep.status === "queued"
        ? "provisioning"
        : dep.status;

    await ctx.db.patch(args.id, { steps, status: deploymentStatus });
  },
});

export const setPort = mutation({
  args: {
    id: v.id("deployments"),
    port: v.number(),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) throw new Error("Deployment not found");
    await ctx.db.patch(args.id, { port: args.port });
  },
});

export const complete = mutation({
  args: {
    id: v.id("deployments"),
    gatewayInstanceId: v.id("gatewayInstances"),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) throw new Error("Deployment not found");

    await ctx.db.patch(args.id, {
      status: "running",
      gatewayInstanceId: args.gatewayInstanceId,
      completedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    id: v.id("deployments"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.id);
    if (!dep) throw new Error("Deployment not found");

    // Skip remaining pending steps
    const steps = dep.steps.map((s) => ({
      ...s,
      status: s.status === "pending" ? ("skipped" as const) : s.status,
    }));

    await ctx.db.patch(args.id, {
      status: "failed",
      error: args.error,
      steps,
      completedAt: Date.now(),
    });
  },
});
