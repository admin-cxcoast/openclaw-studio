import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";

/**
 * GET /api/org/knowledge
 *
 * Agent-facing endpoint for reading knowledge entries.
 * Auth: Bearer <gateway-instance-token>
 * Query params: key (exact match), q (full-text search), or none (list all)
 */
export async function GET(req: NextRequest) {
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

    const orgId = instance.orgId as Id<"organizations">;
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const q = searchParams.get("q");

    if (key) {
      const entry = await convex.query(api.knowledge.getByKey, { orgId, key });
      return NextResponse.json({ entries: entry ? [entry] : [] });
    }

    if (q) {
      const entries = await convex.query(api.knowledge.search, {
        orgId,
        query: q,
      });
      return NextResponse.json({ entries });
    }

    const entries = await convex.query(api.knowledge.list, { orgId });
    return NextResponse.json({ entries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
