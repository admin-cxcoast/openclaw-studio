import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";

/**
 * POST /api/org/knowledge/propose
 *
 * Agent-facing endpoint for proposing knowledge entries.
 * Auth: Bearer <gateway-instance-token>
 * Body: { agentId, key, content, tags }
 */
export async function POST(req: NextRequest) {
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Authenticate via Bearer token
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 },
      );
    }
    const token = authHeader.slice(7);

    const instance = await convex.query(api.gatewayInstances.getByToken, {
      token,
    });
    if (!instance) {
      return NextResponse.json(
        { error: "Invalid gateway token" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { agentId, key, content, tags } = body as {
      agentId?: string;
      key?: string;
      content?: string;
      tags?: string[];
    };

    if (!agentId || !key || !content) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, key, content" },
        { status: 400 },
      );
    }

    const orgId = instance.orgId as Id<"organizations">;
    const instanceId = instance._id as Id<"gatewayInstances">;

    const proposalId = await convex.mutation(
      api.knowledgeProposals.createFromAgent,
      {
        orgId,
        instanceId,
        agentId,
        key,
        content,
        tags: tags ?? [],
      },
    );

    return NextResponse.json({ ok: true, proposalId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
