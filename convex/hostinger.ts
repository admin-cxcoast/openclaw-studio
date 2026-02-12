"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

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

    let synced = 0;
    for (const vm of machines) {
      const status = mapHostingerStatus(vm.state);
      await ctx.runMutation(api.vpsInstances.upsertFromHostinger, {
        hostingerId: String(vm.id),
        hostname: vm.hostname ?? `vps-${vm.id}`,
        ipAddress: vm.ip ?? "",
        region: vm.region,
        plan: vm.plan,
        status,
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
