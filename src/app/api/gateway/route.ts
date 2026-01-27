import { NextResponse } from "next/server";

import { loadClawdbotConfig } from "@/lib/clawdbot/config";
import { resolveGatewayConfig } from "@/lib/clawdbot/gateway";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { config } = loadClawdbotConfig();
    const { gatewayUrl, token } = resolveGatewayConfig(config);
    return NextResponse.json({ gatewayUrl, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load gateway config.";
    if (message.startsWith("Missing config at")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    logger.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
