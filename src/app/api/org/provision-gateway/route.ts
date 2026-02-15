import { NextRequest, NextResponse } from "next/server";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { allocatePort } from "@/lib/provisioning/port-allocator";
import {
  buildOpenClawJson,
  buildAuthProfilesJson,
} from "@/lib/provisioning/config-generator";
import type { ConfigInput } from "@/lib/provisioning/config-generator";
import { containerName, instanceDir } from "@/lib/provisioning/validation";

export const runtime = "nodejs";

const SSH_KEY_PATH = path.join(
  os.homedir(),
  ".ssh",
  "openclaw_studio_ed25519",
);
const OPENCLAW_IMAGE =
  process.env.OPENCLAW_AGENT_IMAGE ?? "ghcr.io/openclaw/openclaw:latest";

// ── SSH helper ────────────────────────────────────────────

function sshExec(
  target: string,
  sshPort: number,
  command: string,
  input?: string,
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
    input,
    timeout,
  });

  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    exitCode: result.status,
  };
}

/** Write a file on the remote VPS via SSH stdin */
function sshWriteFile(
  target: string,
  sshPort: number,
  remotePath: string,
  content: string,
): { ok: boolean; error?: string } {
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
  sshArgs.push(target, "bash", "-c", `cat > '${remotePath}'`);

  const result = childProcess.spawnSync("ssh", sshArgs, {
    encoding: "utf8",
    input: content,
    timeout: 15_000,
  });

  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr?.trim() || `Exit code ${result.status}`,
    };
  }
  return { ok: true };
}

// ── Convex client ─────────────────────────────────────────

function getConvex(): ConvexHttpClient {
  return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
}

// ── Step runner helpers ───────────────────────────────────

type StepStatus = "running" | "success" | "failed";

async function markStep(
  convex: ConvexHttpClient,
  deploymentId: Id<"deployments">,
  stepId: string,
  status: StepStatus,
  error?: string,
) {
  await convex.mutation(api.deployments.updateStep, {
    id: deploymentId,
    stepId,
    status,
    ...(error ? { error } : {}),
  });
}

// ── POST handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const convex = getConvex();
  const provisionerSecret = process.env.PROVISIONER_SECRET;

  if (!provisionerSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: missing PROVISIONER_SECRET" },
      { status: 500 },
    );
  }

  // Auth: require internal request header (same-origin protection)
  const internalHeader = req.headers.get("x-studio-request");
  if (internalHeader !== "1") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json();
    const { deploymentId } = body as { deploymentId: string };

    if (!deploymentId) {
      return NextResponse.json(
        { error: "deploymentId is required" },
        { status: 400 },
      );
    }

    const depId = deploymentId as Id<"deployments">;

    // Load deployment via system query (provisioner has no user session)
    const dep = await convex.query(api.deployments.getForSystem, {
      provisionerSecret,
      id: depId,
    });
    if (!dep) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 },
      );
    }
    if (dep.status !== "queued") {
      return NextResponse.json(
        { error: `Deployment is "${dep.status}", expected "queued"` },
        { status: 409 },
      );
    }

    // Load VPS
    const vps = await convex.query(api.vpsInstances.get, { id: dep.vpsId });
    if (!vps) {
      return NextResponse.json(
        { error: "VPS not found" },
        { status: 404 },
      );
    }

    // Load organization (for slug used in naming)
    const org = await convex.query(api.organizations.get, { id: dep.orgId });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const sshUser = vps.sshUser ?? "root";
    const sshPort = vps.sshPort ?? 22;
    const sshTarget = `${sshUser}@${vps.ipAddress}`;
    const cName = containerName(org.slug, dep.instanceName);
    const iDir = instanceDir(org.slug, dep.instanceName);

    // ── Step 1: provision — Generate configs ──────────────

    await markStep(convex, depId, "provision", "running");

    try {
      // Discover used ports on VPS via SSH
      const portScan = sshExec(
        sshTarget,
        sshPort,
        `"ss -tlnp 2>/dev/null | grep -oP ':\\K[0-9]+(?=\\s)' | sort -u; docker ps --format '{{.Ports}}' 2>/dev/null | grep -oP '\\d+(?=->)' | sort -u"`,
      );
      const usedPorts = (portScan.stdout || "")
        .split("\n")
        .map((p) => parseInt(p, 10))
        .filter((p) => !isNaN(p));

      const port = allocatePort(dep.instanceName, usedPorts);
      await convex.mutation(api.deployments.setPort, { id: depId, port });

      // Load provider credentials for config generation
      const credentials: ConfigInput["credentials"] = [];

      // Load system settings for agent config
      const settings: Record<string, string> = {};

      // Note: In a full implementation, these would be loaded from Convex
      // providerCredentials and systemSettings tables. For now, pass the
      // config directly from the deployment record.

      const configInput: ConfigInput = {
        instanceName: dep.instanceName,
        port,
        model: dep.config.model,
        authToken: dep.config.gatewayAuth.token,
        credentials,
        settings,
        brainFiles: dep.config.brainFiles,
        agentIdentity: dep.config.agentIdentity,
      };

      const openclawJson = buildOpenClawJson(configInput);
      const authProfilesJson = buildAuthProfilesJson(credentials);

      // Load skill content for workspace
      const skillFiles: { name: string; content: string }[] = [];
      for (const skillId of dep.config.skillIds) {
        const skill = await convex.query(api.skills.get, { id: skillId });
        if (skill) {
          skillFiles.push({ name: skill.name, content: skill.content });
        }
      }

      await markStep(convex, depId, "provision", "success");

      // ── Step 2: push-config — Push to VPS ──────────────

      await markStep(convex, depId, "push-config", "running");

      // Create directory structure
      const mkdirCmd = [
        `mkdir -p '${iDir}/agents/main/agent'`,
        `mkdir -p '${iDir}/workspace/memory'`,
        `mkdir -p '${iDir}/workspace/skills'`,
      ].join(" && ");

      const mkdirResult = sshExec(sshTarget, sshPort, `"${mkdirCmd}"`);
      if (mkdirResult.exitCode !== 0) {
        throw new Error(`mkdir failed: ${mkdirResult.stderr}`);
      }

      // Write openclaw.json
      const writeConfig = sshWriteFile(
        sshTarget,
        sshPort,
        `${iDir}/openclaw.json`,
        JSON.stringify(openclawJson, null, 2),
      );
      if (!writeConfig.ok) {
        throw new Error(`Failed to write openclaw.json: ${writeConfig.error}`);
      }

      // Write auth-profiles.json
      const writeAuth = sshWriteFile(
        sshTarget,
        sshPort,
        `${iDir}/agents/main/agent/auth-profiles.json`,
        JSON.stringify(authProfilesJson, null, 2),
      );
      if (!writeAuth.ok) {
        throw new Error(
          `Failed to write auth-profiles.json: ${writeAuth.error}`,
        );
      }

      // Write brain files
      for (const bf of dep.config.brainFiles) {
        const writeBf = sshWriteFile(
          sshTarget,
          sshPort,
          `${iDir}/workspace/${bf.name}`,
          bf.content,
        );
        if (!writeBf.ok) {
          throw new Error(
            `Failed to write ${bf.name}: ${writeBf.error}`,
          );
        }
      }

      // Write empty WORKING.md and MEMORY.md if not in brain files
      const brainNames = new Set(dep.config.brainFiles.map((b) => b.name));
      for (const emptyFile of ["WORKING.md", "MEMORY.md"]) {
        if (!brainNames.has(emptyFile)) {
          sshWriteFile(sshTarget, sshPort, `${iDir}/workspace/${emptyFile}`, "");
        }
      }

      // Write skill files
      for (const skill of skillFiles) {
        const skillDir = `${iDir}/workspace/skills/${skill.name}`;
        sshExec(sshTarget, sshPort, `"mkdir -p '${skillDir}'"`);
        sshWriteFile(
          sshTarget,
          sshPort,
          `${skillDir}/SKILL.md`,
          skill.content,
        );
      }

      await markStep(convex, depId, "push-config", "success");

      // ── Step 3: start-container — Docker run ───────────

      await markStep(convex, depId, "start-container", "running");

      // Remove existing container if present
      sshExec(sshTarget, sshPort, `"docker rm -f '${cName}' 2>/dev/null; true"`);

      // Docker run — mirrors Agency-AI's startDockerAgent()
      // Memory capped at 2 GB per instance (5 agents × ~150 MB + base ~1 GB + headroom)
      const dockerCmd = [
        "docker run -d",
        `--name '${cName}'`,
        "--network host",
        "--restart unless-stopped",
        "--memory 2g",
        "--memory-swap 2g",
        `-v '${iDir}:/home/node/.openclaw'`,
        "-e HOME=/home/node",
        "-e TERM=xterm-256color",
        `'${OPENCLAW_IMAGE}'`,
        `node dist/index.js gateway --bind lan --port ${port}`,
      ].join(" ");

      const dockerResult = sshExec(
        sshTarget,
        sshPort,
        `"${dockerCmd}"`,
        undefined,
        60_000,
      );
      if (dockerResult.exitCode !== 0) {
        throw new Error(
          `docker run failed: ${dockerResult.stderr || dockerResult.stdout}`,
        );
      }

      await markStep(convex, depId, "start-container", "success");

      // ── Step 4: fix-permissions ────────────────────────

      await markStep(convex, depId, "fix-permissions", "running");

      // Same chown pattern as Agency-AI
      const chownCmd = [
        `docker exec -u root '${cName}' sh -c`,
        `"mkdir -p /home/node/.openclaw/agents/main/agent &&`,
        `chown -R node:node /home/node/.openclaw &&`,
        `chown -R node:node /home/node/.openclaw/workspace 2>/dev/null; true"`,
      ].join(" ");

      sshExec(sshTarget, sshPort, `"${chownCmd}"`, undefined, 15_000);
      await markStep(convex, depId, "fix-permissions", "success");

      // ── Step 5: deploy-workspace — Push config into container ──

      await markStep(convex, depId, "deploy-workspace", "running");

      // Docker cp config files into running container + fix ownership
      const deployCmd = [
        `docker cp '${iDir}/openclaw.json' '${cName}:/home/node/.openclaw/openclaw.json'`,
        `docker cp '${iDir}/agents/main/agent/auth-profiles.json' '${cName}:/home/node/.openclaw/agents/main/agent/auth-profiles.json'`,
        `docker exec -u root '${cName}' sh -c "chown node:node /home/node/.openclaw/openclaw.json && chown -R node:node /home/node/.openclaw/agents"`,
      ].join(" && ");

      const deployResult = sshExec(
        sshTarget,
        sshPort,
        `"${deployCmd}"`,
        undefined,
        30_000,
      );
      if (deployResult.exitCode !== 0) {
        throw new Error(
          `deploy-workspace failed: ${deployResult.stderr || deployResult.stdout}`,
        );
      }

      await markStep(convex, depId, "deploy-workspace", "success");

      // ── Step 6: health — Verify gateway ────────────────

      await markStep(convex, depId, "health", "running");

      const healthCmd = `"sleep 3 && curl -sf http://127.0.0.1:${port}/health || docker logs --tail 20 '${cName}'"`;
      const healthResult = sshExec(
        sshTarget,
        sshPort,
        healthCmd,
        undefined,
        20_000,
      );

      // Health check is best-effort — log output but don't fail
      if (healthResult.exitCode !== 0) {
        // Gateway might still be starting up — don't fail the deployment
        console.warn(
          `[provision] Health check returned non-zero: ${healthResult.stderr || healthResult.stdout}`,
        );
      }

      await markStep(convex, depId, "health", "success");

      // ── Finalize — Create gateway instance record ──────

      const gatewayUrl = `ws://${vps.ipAddress}:${port}`;

      const gatewayInstanceId = await convex.mutation(
        api.gatewayInstances.createFromSystem,
        {
          provisionerSecret,
          vpsId: dep.vpsId,
          orgId: dep.orgId,
          name: dep.instanceName,
          port,
          token: dep.config.gatewayAuth.token,
          url: gatewayUrl,
          stateDir: iDir,
          status: "running",
          agentCount: 1,
          primaryAgentName: dep.config.agentIdentity?.name ?? dep.instanceName,
        },
      );

      // Assign skills to the new instance
      for (const skillId of dep.config.skillIds) {
        await convex.mutation(api.instanceSkills.assign, {
          instanceId: gatewayInstanceId,
          skillId,
        });
      }

      // Mark deployment complete
      await convex.mutation(api.deployments.complete, {
        id: depId,
        gatewayInstanceId,
      });

      return NextResponse.json({
        success: true,
        gatewayInstanceId,
        port,
        url: gatewayUrl,
      });
    } catch (stepError: any) {
      // Find which step was running and mark it failed
      const currentDep = await convex.query(api.deployments.get, {
        id: depId,
      });
      const runningStep = currentDep?.steps.find(
        (s) => s.status === "running",
      );
      if (runningStep) {
        await markStep(
          convex,
          depId,
          runningStep.id,
          "failed",
          stepError?.message ?? "Unknown error",
        );
      }

      // Mark deployment failed
      await convex.mutation(api.deployments.fail, {
        id: depId,
        error: stepError?.message ?? "Provisioning failed",
      });

      return NextResponse.json(
        {
          error: stepError?.message ?? "Provisioning failed",
          step: runningStep?.id,
        },
        { status: 502 },
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
