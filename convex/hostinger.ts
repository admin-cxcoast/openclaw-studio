"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// ── KVM tier capacity defaults ───────────────────────────
// Based on Hostinger KVM specs vs OpenClaw gateway resource profile:
//   ~1 GB RAM per instance, 25% headroom, OS+Docker overhead ~1 GB
//   KVM 1: 4 GB RAM → 2 instances
//   KVM 2: 8 GB RAM → 4 instances
//   KVM 4: 16 GB RAM → 8 instances
//   KVM 8: 32 GB RAM → 16 instances
const DEFAULT_PLAN_CAPACITY: Record<string, number> = {
  "kvm-1": 2,
  "kvm-2": 4,
  "kvm-4": 8,
  "kvm-8": 16,
};

// Approximate Hostinger monthly costs per KVM tier (in cents)
const DEFAULT_PLAN_COST_CENTS: Record<string, number> = {
  "kvm-1": 599,
  "kvm-2": 999,
  "kvm-4": 1999,
  "kvm-8": 3999,
};

async function fetchHostingerConfig(
  runQuery: (query: typeof api.systemSettings.getByKey, args: { key: string }) => Promise<{ _id: unknown; value: string; sensitive: boolean } | null>,
  revealQuery: (query: typeof api.systemSettings.reveal, args: { id: unknown }) => Promise<string>,
): Promise<{ apiKey: string; apiUrl: string }> {
  const apiKeyDoc = await runQuery(api.systemSettings.getByKey, {
    key: "hostinger_api_key",
  });
  const apiUrlDoc = await runQuery(api.systemSettings.getByKey, {
    key: "hostinger_api_url",
  });
  const apiKey: string = apiKeyDoc
    ? await revealQuery(api.systemSettings.reveal, { id: (apiKeyDoc as { _id: any })._id } as any)
    : "";
  const apiUrl: string = apiUrlDoc?.value ?? "https://developers.hostinger.com";
  if (!apiKey) throw new Error("Hostinger API key not configured. Set it in Settings → VPS.");
  return { apiKey, apiUrl };
}

export const listVirtualMachines = action({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    const res = await fetch(`${apiUrl}/api/vps/v1/virtual-machines`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Hostinger API error: ${res.status} ${await res.text()}`);
    }
    return res.json();
  },
});

export const syncVpsFromHostinger = action({
  args: {},
  handler: async (ctx): Promise<{ synced: number; total: number }> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    const res = await fetch(`${apiUrl}/api/vps/v1/virtual-machines`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Hostinger API error: ${res.status} ${await res.text()}`);
    }
    const machines: Array<{
      id: number;
      hostname: string;
      ip: string;
      region?: string;
      plan?: string;
      state?: string;
    }> = await res.json();

    // Load plan→capacity mapping from system settings
    let planCapacity: Record<string, number> = {};
    try {
      const capacityDoc = await (ctx.runQuery as any)(api.systemSettings.getByKey, {
        key: "vps_plan_capacity",
      });
      if (capacityDoc?.value) {
        planCapacity = JSON.parse(capacityDoc.value);
      }
    } catch {
      // Use defaults if not configured
    }

    let synced = 0;
    for (const vm of machines) {
      const status = mapHostingerStatus(vm.state);
      const planKey = vm.plan?.toLowerCase();
      const maxInstances = planKey
        ? (planCapacity[planKey] ?? DEFAULT_PLAN_CAPACITY[planKey])
        : undefined;
      const monthlyCostCents = planKey
        ? DEFAULT_PLAN_COST_CENTS[planKey]
        : undefined;
      await ctx.runMutation(api.vpsInstances.upsertFromHostinger, {
        hostingerId: String(vm.id),
        hostname: vm.hostname ?? `vps-${vm.id}`,
        ipAddress: vm.ip ?? "",
        region: vm.region,
        plan: vm.plan,
        status,
        maxInstances,
        monthlyCostCents,
      });
      synced++;
    }
    return { synced, total: machines.length };
  },
});

export const createVirtualMachine = action({
  args: {
    period: v.number(),
    plan: v.string(),
    datacenter: v.string(),
    hostname: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ id: number; hostname: string; ip: string }> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    const res = await fetch(`${apiUrl}/api/vps/v1/virtual-machines`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        period: args.period,
        plan: args.plan,
        datacenter: args.datacenter,
        template: "ubuntu-24",
        hostname: args.hostname,
        password: args.password,
      }),
    });
    if (!res.ok) {
      throw new Error(`Hostinger API error: ${res.status} ${await res.text()}`);
    }
    const vm: { id: number; hostname: string; ip: string } = await res.json();
    await ctx.runMutation(api.vpsInstances.upsertFromHostinger, {
      hostingerId: String(vm.id),
      hostname: vm.hostname ?? args.hostname,
      ipAddress: vm.ip ?? "",
      status: "provisioning",
    });
    return vm;
  },
});

// ── SSH Key Management ────────────────────────────────────

export const registerSshKey = action({
  args: { publicKey: v.string() },
  handler: async (ctx, args): Promise<{ id: number; name: string }> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    // Check if key already registered
    const listRes = await fetch(`${apiUrl}/api/vps/v1/public-keys`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (listRes.ok) {
      const keys: Array<{ id: number; name: string; key: string }> =
        await listRes.json();
      const existing = keys.find(
        (k) =>
          k.name === "openclaw-studio" ||
          k.key?.trim() === args.publicKey.trim(),
      );
      if (existing) {
        return { id: existing.id, name: existing.name };
      }
    }

    // Register new key
    const res = await fetch(`${apiUrl}/api/vps/v1/public-keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "openclaw-studio",
        key: args.publicKey.trim(),
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Hostinger API error registering SSH key: ${res.status} ${await res.text()}`,
      );
    }
    const result: { id: number; name: string } = await res.json();
    return result;
  },
});

export const attachSshKeyToAllVps = action({
  args: { publicKeyId: v.number() },
  handler: async (ctx, args): Promise<{
    attached: number;
    failed: number;
    details: Array<{ hostname: string; hostingerId: string; status: number; body: string }>;
  }> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    const vpsList = await ctx.runQuery(api.vpsInstances.list);
    let attached = 0;
    let failed = 0;
    const details: Array<{ hostname: string; hostingerId: string; status: number; body: string }> = [];

    for (const vps of vpsList) {
      if (!vps.hostingerId) continue;
      try {
        const res = await fetch(
          `${apiUrl}/api/vps/v1/public-keys/attach/${vps.hostingerId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: [args.publicKeyId] }),
          },
        );
        const body = await res.text();
        details.push({
          hostname: vps.hostname,
          hostingerId: vps.hostingerId,
          status: res.status,
          body: body.slice(0, 500),
        });
        if (res.ok || res.status === 409) {
          attached++;
        } else {
          failed++;
        }
      } catch (err: any) {
        details.push({
          hostname: vps.hostname,
          hostingerId: vps.hostingerId,
          status: 0,
          body: err?.message ?? "Unknown error",
        });
        failed++;
      }
    }
    return { attached, failed, details };
  },
});

export const debugAttachedKeys = action({
  args: { hostingerId: v.string() },
  handler: async (ctx, args): Promise<unknown> => {
    const { apiKey, apiUrl } = await fetchHostingerConfig(
      ctx.runQuery as any,
      ctx.runQuery as any,
    );
    const res = await fetch(
      `${apiUrl}/api/vps/v1/virtual-machines/${args.hostingerId}/public-keys`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      return { error: `${res.status} ${await res.text()}` };
    }
    return res.json();
  },
});

function mapHostingerStatus(
  state?: string,
): "provisioning" | "running" | "stopped" | "error" | "unassigned" {
  switch (state?.toLowerCase()) {
    case "running":
    case "active":
      return "running";
    case "stopped":
    case "paused":
      return "stopped";
    case "initial":
    case "installing":
    case "restoring":
      return "provisioning";
    case "error":
    case "failed":
      return "error";
    default:
      return "running";
  }
}
