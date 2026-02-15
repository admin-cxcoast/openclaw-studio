import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const runtime = "nodejs";

function getConvex(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

/**
 * POST /api/gateway/usage-report
 *
 * Receives LLM usage reports from gateway instances.
 * Gateway sends raw token counts; cost is calculated server-side
 * using model pricing from the database (set by super admin).
 *
 * Auth: instance token in Authorization header, matched against
 * the gatewayInstances table.
 *
 * Body:
 *   { agentId, modelId, inputTokens, outputTokens, period? }
 *
 * Can also accept batch reports:
 *   { records: [{ agentId, modelId, inputTokens, outputTokens }], period? }
 */
export async function POST(req: NextRequest) {
  const convex = getConvex();

  // Auth: require instance token
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Authorization required" },
      { status: 401 },
    );
  }
  const instanceToken = authHeader.slice(7);

  const provisionerSecret = process.env.PROVISIONER_SECRET;
  if (!provisionerSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: missing PROVISIONER_SECRET" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();

    // Resolve instance from token
    // The gateway instance token is stored in gatewayInstances.token
    // We need to find the instance by token — use a system query
    const instanceId = body.instanceId as string | undefined;
    if (!instanceId) {
      return NextResponse.json(
        { error: "instanceId is required" },
        { status: 400 },
      );
    }

    // Derive current period if not provided
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Handle single record or batch
    const records: Array<{
      agentId: string;
      modelId: string;
      inputTokens: number;
      outputTokens: number;
    }> = body.records ?? [body];

    const results: Array<{ costCents: number; modelPriced: boolean }> = [];

    for (const record of records) {
      if (
        !record.agentId ||
        !record.modelId ||
        typeof record.inputTokens !== "number" ||
        typeof record.outputTokens !== "number"
      ) {
        return NextResponse.json(
          {
            error:
              "Each record requires agentId, modelId, inputTokens, outputTokens",
          },
          { status: 400 },
        );
      }

      const result = await convex.mutation(
        api.usageRecords.recordFromGateway,
        {
          provisionerSecret,
          instanceId: instanceId as Id<"gatewayInstances">,
          agentId: record.agentId,
          modelId: record.modelId,
          inputTokens: record.inputTokens,
          outputTokens: record.outputTokens,
          period: body.period ?? defaultPeriod,
        },
      );

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      recorded: results.length,
      results,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
