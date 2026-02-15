import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";

type Action = "create" | "remove";

function getConvex(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * POST /api/org/manage-agent
 *
 * Proxies agent create/remove operations to the gateway via WebSocket RPC.
 * Flow:
 *   1. Validate request + quota (via Convex agents.requestCreate)
 *   2. Connect to gateway WebSocket, call agents.create/remove RPC
 *   3. On success, update agentCount in Convex
 */
export async function POST(req: NextRequest) {
  const convex = getConvex();

  // Auth: require internal request header
  const internalHeader = req.headers.get("x-studio-request");
  if (internalHeader !== "1") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const { instanceId, action, agentName } = body as {
      instanceId: string;
      action: Action;
      agentName: string;
    };

    if (!instanceId || !action || !agentName) {
      return NextResponse.json(
        { error: "instanceId, action, and agentName are required" },
        { status: 400 },
      );
    }

    if (!["create", "remove"].includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Must be "create" or "remove"` },
        { status: 400 },
      );
    }

    const instId = instanceId as Id<"gatewayInstances">;

    // Load instance to get gateway URL + token
    const instance = await convex.query(api.gatewayInstances.get, {
      id: instId,
    });
    if (!instance) {
      return NextResponse.json(
        { error: "Gateway instance not found" },
        { status: 404 },
      );
    }

    if (instance.status !== "running") {
      return NextResponse.json(
        { error: `Instance is "${instance.status}", must be "running"` },
        { status: 409 },
      );
    }

    // Resolve gateway URL
    const vps = await convex.query(api.vpsInstances.get, {
      id: instance.vpsId,
    });
    const gatewayUrl =
      instance.url ??
      (vps
        ? `ws://${vps.ipAddress || vps.hostname}:${instance.port}`
        : null);
    if (!gatewayUrl) {
      return NextResponse.json(
        { error: "Cannot resolve gateway URL" },
        { status: 500 },
      );
    }

    // Convert ws:// to http:// for REST-style RPC
    const httpUrl = gatewayUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:");

    if (action === "create") {
      // Call gateway RPC: agents.create
      const rpcRes = await fetch(`${httpUrl}/rpc/agents.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(instance.token
            ? { Authorization: `Bearer ${instance.token}` }
            : {}),
        },
        body: JSON.stringify({ name: agentName }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!rpcRes.ok) {
        const errText = await rpcRes.text().catch(() => "Unknown error");
        return NextResponse.json(
          { error: `Gateway RPC failed: ${errText}` },
          { status: 502 },
        );
      }

      const rpcData = await rpcRes.json().catch(() => ({}));

      // Update agent count in Convex via provisioner secret
      const provisionerSecret = process.env.PROVISIONER_SECRET;
      if (provisionerSecret) {
        await convex.mutation(api.gatewayInstances.updateFromSystem, {
          provisionerSecret,
          id: instId,
          agentCount: (instance.agentCount ?? 1) + 1,
        });
      }

      return NextResponse.json({
        success: true,
        action: "create",
        agentName,
        agentId: rpcData.agentId ?? agentName,
      });
    } else {
      // action === "remove"
      const rpcRes = await fetch(`${httpUrl}/rpc/agents.remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(instance.token
            ? { Authorization: `Bearer ${instance.token}` }
            : {}),
        },
        body: JSON.stringify({ name: agentName }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!rpcRes.ok) {
        const errText = await rpcRes.text().catch(() => "Unknown error");
        return NextResponse.json(
          { error: `Gateway RPC failed: ${errText}` },
          { status: 502 },
        );
      }

      // Update agent count
      const provisionerSecret = process.env.PROVISIONER_SECRET;
      if (provisionerSecret) {
        await convex.mutation(api.gatewayInstances.updateFromSystem, {
          provisionerSecret,
          id: instId,
          agentCount: Math.max(0, (instance.agentCount ?? 1) - 1),
        });
      }

      return NextResponse.json({
        success: true,
        action: "remove",
        agentName,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
