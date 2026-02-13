import { NextRequest, NextResponse } from "next/server";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const runtime = "nodejs";

const SSH_KEY_PATH = path.join(os.homedir(), ".ssh", "openclaw_studio_ed25519");

/**
 * SSH into a VPS and discover running OpenClaw gateway instances.
 *
 * Discovery checks:
 * 1. Host: ~/.openclaw/openclaw.json → gateway port + auth token
 * 2. Host: /opt/openclaw/instances/ → multi-instance setups
 * 3. Host: Running openclaw processes via ss -tlnp
 * 4. Docker: Running containers with openclaw/gateway in image/name
 *    - Reads config via docker exec
 *    - Extracts host port mappings
 * 5. Docker Compose: docker-compose.yml in common locations
 */

const DISCOVERY_SCRIPT = `
set -euo pipefail

python3 - <<'PY'
import json
import os
import pathlib
import re
import subprocess
import sys

results = []

def run(cmd, timeout=10):
    """Run a command and return stdout or empty string."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""

def read_config(base_dir):
    """Read openclaw.json config from a host directory."""
    config_path = base_dir / "openclaw.json"
    if not config_path.exists():
        return None
    try:
        with open(config_path) as f:
            config = json.load(f)
        gateway = config.get("gateway", {})
        port = gateway.get("port")
        auth = gateway.get("auth", {})
        token = auth.get("token")
        return {"port": port, "token": token}
    except Exception:
        return None

def count_agents(base_dir):
    """Count agent directories on host."""
    agents_dir = base_dir / "agents"
    if not agents_dir.is_dir():
        return 0
    return len([d for d in agents_dir.iterdir() if d.is_dir()])

def read_config_from_docker(container_id):
    """Read openclaw.json from inside a Docker container."""
    # Try common config paths inside the container
    for cfg_path in [
        "/root/.openclaw/openclaw.json",
        "/home/openclaw/.openclaw/openclaw.json",
        "/app/openclaw.json",
        "/opt/openclaw/openclaw.json",
        "/data/openclaw.json",
    ]:
        out = run(["docker", "exec", container_id, "cat", cfg_path])
        if out:
            try:
                config = json.loads(out)
                gateway = config.get("gateway", {})
                port = gateway.get("port")
                auth = gateway.get("auth", {})
                token = auth.get("token")
                return {"port": port, "token": token, "configPath": cfg_path}
            except Exception:
                continue
    return None

def count_agents_docker(container_id):
    """Count agent directories inside a Docker container."""
    for agents_dir in [
        "/root/.openclaw/agents",
        "/home/openclaw/.openclaw/agents",
        "/opt/openclaw/agents",
        "/data/agents",
    ]:
        out = run(["docker", "exec", container_id, "ls", "-1", agents_dir])
        if out:
            return len([d for d in out.splitlines() if d.strip()])
    return 0

def get_docker_port_mappings(container_id):
    """Get host:container port mappings for a container."""
    out = run(["docker", "port", container_id])
    mappings = []
    for line in out.splitlines():
        # Format: "18789/tcp -> 0.0.0.0:18789"
        m = re.match(r"(\d+)/\w+\s*->\s*[\d.]+:(\d+)", line)
        if m:
            mappings.append({
                "container_port": int(m.group(1)),
                "host_port": int(m.group(2)),
            })
    return mappings

# ── 1. Host: default home directory ──
home = pathlib.Path.home()
default_base = home / ".openclaw"
if default_base.is_dir():
    cfg = read_config(default_base)
    if cfg and cfg.get("port"):
        results.append({
            "stateDir": str(default_base),
            "port": cfg["port"],
            "token": cfg.get("token"),
            "agentCount": count_agents(default_base),
            "source": "host",
        })

# ── 2. Host: /opt/openclaw/instances/ ──
instances_root = pathlib.Path("/opt/openclaw/instances")
if instances_root.is_dir():
    for inst_dir in sorted(instances_root.iterdir()):
        if not inst_dir.is_dir():
            continue
        cfg = read_config(inst_dir)
        if cfg and cfg.get("port"):
            results.append({
                "stateDir": str(inst_dir),
                "port": cfg["port"],
                "token": cfg.get("token"),
                "agentCount": count_agents(inst_dir),
                "source": "host-multi",
            })

# ── 3. Host: process scan ──
try:
    ss_out = run(["ss", "-tlnp"])
    for line in ss_out.splitlines():
        if "openclaw" in line.lower() or "gateway" in line.lower():
            m = re.search(r":(\d+)\s", line)
            if m:
                port = int(m.group(1))
                known = {r["port"] for r in results}
                if port not in known:
                    results.append({
                        "stateDir": None,
                        "port": port,
                        "token": None,
                        "agentCount": 0,
                        "source": "host-process",
                    })
except Exception:
    pass

# ── 4. Docker containers ──
docker_available = bool(run(["docker", "info", "--format", "{{.ID}}"]))
if docker_available:
    # List all running containers (ID, image, name, ports)
    fmt = '{{.ID}}\\t{{.Image}}\\t{{.Names}}\\t{{.Ports}}'
    containers_out = run(["docker", "ps", "--format", fmt, "--no-trunc"])
    for line in containers_out.splitlines():
        parts = line.split("\\t")
        if len(parts) < 4:
            continue
        cid, image, name, ports_str = parts[0], parts[1], parts[2], parts[3]

        # Match containers that look like OpenClaw gateways
        search_str = (image + " " + name).lower()
        is_openclaw = any(kw in search_str for kw in [
            "openclaw", "gateway", "oc-gateway", "oc_gateway",
        ])
        if not is_openclaw:
            continue

        # Get port mappings
        mappings = get_docker_port_mappings(cid)
        host_port = None
        container_port = None
        for m in mappings:
            # Prefer the gateway port (usually 18789 or similar)
            host_port = m["host_port"]
            container_port = m["container_port"]
            break

        # Read config from inside the container
        cfg = read_config_from_docker(cid)
        token = None
        config_port = None
        if cfg:
            token = cfg.get("token")
            config_port = cfg.get("port")

        # Determine the port exposed to the host
        effective_port = host_port or config_port
        if not effective_port:
            # Try to extract from ports string: "0.0.0.0:18789->18789/tcp"
            m = re.search(r"0\.0\.0\.0:(\d+)->", ports_str)
            if m:
                effective_port = int(m.group(1))

        if not effective_port:
            continue

        agent_count = count_agents_docker(cid)

        results.append({
            "stateDir": f"docker:{name}",
            "port": effective_port,
            "token": token,
            "agentCount": agent_count,
            "source": "docker",
            "containerId": cid[:12],
            "containerName": name,
            "image": image,
        })

    # ── 5. Also check for docker-proxy listening ports ──
    # Docker forwards ports via docker-proxy which shows up in ss
    try:
        ss_out = run(["ss", "-tlnp"])
        known_ports = {r["port"] for r in results}
        for line in ss_out.splitlines():
            if "docker-proxy" in line.lower():
                m = re.search(r":(\d+)\s", line)
                if m:
                    port = int(m.group(1))
                    if port not in known_ports:
                        results.append({
                            "stateDir": None,
                            "port": port,
                            "token": None,
                            "agentCount": 0,
                            "source": "docker-proxy",
                        })
    except Exception:
        pass

# Deduplicate by port
seen_ports = set()
deduped = []
for r in results:
    if r["port"] not in seen_ports:
        seen_ports.add(r["port"])
        deduped.append(r)

print(json.dumps({"instances": deduped, "dockerAvailable": docker_available}))
PY
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ipAddress, sshUser, sshPort } = body as {
      ipAddress: string;
      sshUser?: string;
      sshPort?: number;
    };

    const host = ipAddress?.trim();
    if (!host) {
      return NextResponse.json(
        { error: "ipAddress (or hostname) is required" },
        { status: 400 },
      );
    }

    const user = sshUser || "root";
    const target = `${user}@${host}`;
    const sshArgs = [
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=10",
    ];
    // Use generated SSH key if available
    if (fs.existsSync(SSH_KEY_PATH)) {
      sshArgs.push("-i", SSH_KEY_PATH);
    }
    if (sshPort && sshPort !== 22) {
      sshArgs.push("-p", String(sshPort));
    }
    sshArgs.push(target, "bash", "-s");

    const result = childProcess.spawnSync("ssh", sshArgs, {
      encoding: "utf8",
      input: DISCOVERY_SCRIPT,
      timeout: 30_000,
    });

    if (result.error) {
      return NextResponse.json(
        { error: `SSH connection failed: ${result.error.message}` },
        { status: 502 },
      );
    }

    if (result.status !== 0) {
      const stderr = result.stderr?.trim() ?? "";
      return NextResponse.json(
        {
          error: `SSH command failed (exit ${result.status}): ${stderr || result.stdout?.trim() || "Unknown error"}`,
        },
        { status: 502 },
      );
    }

    const stdout = result.stdout?.trim() ?? "";
    if (!stdout) {
      return NextResponse.json(
        { error: "Empty response from VPS" },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(stdout);
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Scan failed" },
      { status: 500 },
    );
  }
}
