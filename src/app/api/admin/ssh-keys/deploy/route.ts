import { NextRequest, NextResponse } from "next/server";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const runtime = "nodejs";

const KEY_NAME = "openclaw_studio_ed25519";
const KEY_PATH = path.join(os.homedir(), ".ssh", KEY_NAME);
const PUB_KEY_PATH = `${KEY_PATH}.pub`;

/**
 * POST: Deploy the SSH public key to a VPS using password auth.
 *
 * Uses a raw SSH session to append the public key to the remote
 * authorized_keys file. This is the equivalent of ssh-copy-id but
 * uses `expect` (available on macOS by default) to automate password entry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ipAddress, sshUser, sshPort, password } = body as {
      ipAddress: string;
      sshUser?: string;
      sshPort?: number;
      password: string;
    };

    const host = ipAddress?.trim();
    if (!host) {
      return NextResponse.json({ error: "ipAddress required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "password required" }, { status: 400 });
    }

    if (!fs.existsSync(PUB_KEY_PATH)) {
      return NextResponse.json(
        { error: "SSH public key not found. Generate it first." },
        { status: 400 },
      );
    }

    const pubKey = fs.readFileSync(PUB_KEY_PATH, "utf8").trim();
    const user = sshUser || "root";
    const port = sshPort || 22;

    // Use expect to automate password-based SSH and append the key
    // This is equivalent to ssh-copy-id
    const expectScript = `
set timeout 30
spawn ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p ${port} ${user}@${host} "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${pubKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo DEPLOY_OK"
expect {
  "password:" {
    send "${password.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}\r"
    expect {
      "DEPLOY_OK" {
        exit 0
      }
      "Permission denied" {
        exit 1
      }
      timeout {
        exit 2
      }
      eof {
        exit 3
      }
    }
  }
  "DEPLOY_OK" {
    exit 0
  }
  "Permission denied" {
    exit 1
  }
  timeout {
    exit 2
  }
  eof {
    exit 3
  }
}
`;

    const result = childProcess.spawnSync("expect", ["-c", expectScript], {
      encoding: "utf8",
      timeout: 40_000,
    });

    const output = (result.stdout ?? "") + (result.stderr ?? "");

    if (result.status === 0 && output.includes("DEPLOY_OK")) {
      // Verify key works
      const verifyArgs = [
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=10",
        "-i", KEY_PATH,
        "-p", String(port),
        `${user}@${host}`,
        "echo", "VERIFY_OK",
      ];
      const verify = childProcess.spawnSync("ssh", verifyArgs, {
        encoding: "utf8",
        timeout: 15_000,
      });
      if (verify.stdout?.includes("VERIFY_OK")) {
        return NextResponse.json({ success: true, verified: true });
      }
      return NextResponse.json({
        success: true,
        verified: false,
        message: "Key deployed but verification failed. It may take a moment to activate.",
      });
    }

    if (result.status === 1 || output.includes("Permission denied")) {
      return NextResponse.json(
        { error: "Wrong password. Permission denied." },
        { status: 401 },
      );
    }

    if (result.status === 2) {
      return NextResponse.json(
        { error: "Connection timed out." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { error: `Deploy failed (exit ${result.status}): ${output.slice(-500)}` },
      { status: 502 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Deploy failed" },
      { status: 500 },
    );
  }
}
