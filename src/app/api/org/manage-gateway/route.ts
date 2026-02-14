import { NextRequest, NextResponse } from "next/server";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { containerName, instanceDir } from "@/lib/provisioning/validation";

export const runtime = "nodejs";

const SSH_KEY_PATH = path.join(
  os.homedir(),
  ".ssh",
  "openclaw_studio_ed25519",
);

type Action = "stop" | "start" | "restart" | "delete" | "logs";

// ── SSH helper ────────────────────────────────────────────

function sshExec(
  target: string,
  sshPort: number,
  command: string,
  timeout = 30_000,
): { stdout: string; stderr: string; exitCode: number | null } {
  const sshArgs = [
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
  ];
  if (fs.existsSync(SSH_KEY_PATH)) {
    sshArgs.push("-i", SSH_KEY_PATH);
  }
  if (sshPort !== 22) {
    sshArgs.push("-p", String(sshPort));
  }
  sshArgs.push(target, "bash", "-c", command);

  const result = childProcess.spawnSync("ssh", sshArgs, {
    encoding: "utf8",
    timeout,
  });

  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    exitCode: result.status,
  };
}

// ── Convex client ─────────────────────────────────────────

function getConvex(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// ── POST handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const convex = getConvex();

  try {
    const body = await req.json();
    const { instanceId, action } = body as {
      instanceId: string;
      action: Action;
    };

    if (!instanceId || !action) {
      return NextResponse.json(
        { error: "instanceId and action are required" },
        { status: 400 },
      );
    }

    const validActions: Action[] = ["stop", "start", "restart", "delete", "logs"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    const instId = instanceId as Id<"gatewayInstances">;

    // Load instance
    const gatewayInstance = await convex.query(api.gatewayInstances.get, {
      id: instId,
    });

    if (!gatewayInstance) {
      return NextResponse.json(
        { error: "Gateway instance not found" },
        { status: 404 },
      );
    }

    // Load VPS
    const vps = await convex.query(api.vpsInstances.get, {
      id: gatewayInstance.vpsId,
    });
    if (!vps) {
      return NextResponse.json(
        { error: "VPS not found" },
        { status: 404 },
      );
    }

    // Load org for container naming
    const org = await convex.query(api.organizations.get, {
      id: gatewayInstance.orgId,
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const sshUser = vps.sshUser ?? "root";
    const sshPort = vps.sshPort ?? 22;
    const sshTarget = `${sshUser}@${vps.ipAddress}`;
    const cName = containerName(org.slug, gatewayInstance.name);
    const iDir = instanceDir(org.slug, gatewayInstance.name);

    switch (action) {
      case "stop": {
        const result = sshExec(
          sshTarget,
          sshPort,
          `"docker stop '${cName}'"`,
        );
        if (result.exitCode !== 0) {
          return NextResponse.json(
            { error: `Failed to stop container: ${result.stderr}` },
            { status: 502 },
          );
        }
        await convex.mutation(api.gatewayInstances.update, {
          id: instId,
          status: "stopped",
        });
        return NextResponse.json({ success: true, action: "stop" });
      }

      case "start": {
        const result = sshExec(
          sshTarget,
          sshPort,
          `"docker start '${cName}'"`,
        );
        if (result.exitCode !== 0) {
          return NextResponse.json(
            { error: `Failed to start container: ${result.stderr}` },
            { status: 502 },
          );
        }
        await convex.mutation(api.gatewayInstances.update, {
          id: instId,
          status: "running",
        });
        return NextResponse.json({ success: true, action: "start" });
      }

      case "restart": {
        const result = sshExec(
          sshTarget,
          sshPort,
          `"docker restart '${cName}'"`,
        );
        if (result.exitCode !== 0) {
          return NextResponse.json(
            { error: `Failed to restart container: ${result.stderr}` },
            { status: 502 },
          );
        }
        await convex.mutation(api.gatewayInstances.update, {
          id: instId,
          status: "running",
        });
        return NextResponse.json({ success: true, action: "restart" });
      }

      case "delete": {
        // Remove container
        sshExec(
          sshTarget,
          sshPort,
          `"docker rm -f '${cName}' 2>/dev/null; true"`,
        );
        // Remove config directory
        sshExec(
          sshTarget,
          sshPort,
          `"rm -rf '${iDir}'"`,
        );

        // Remove instance-skill junction records
        const skills = await convex.query(api.instanceSkills.listByInstance, {
          instanceId: instId,
        });
        for (const skill of skills) {
          await convex.mutation(api.instanceSkills.unassign, {
            instanceId: instId,
            skillId: skill.skillId,
          });
        }

        // Delete the gateway instance record
        await convex.mutation(api.gatewayInstances.remove, { id: instId });

        return NextResponse.json({ success: true, action: "delete" });
      }

      case "logs": {
        const result = sshExec(
          sshTarget,
          sshPort,
          `"docker logs '${cName}' --tail 100 2>&1"`,
          15_000,
        );
        return NextResponse.json({
          success: true,
          action: "logs",
          logs: result.stdout || result.stderr || "(no output)",
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
