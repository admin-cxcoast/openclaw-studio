import { NextRequest, NextResponse } from "next/server";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const runtime = "nodejs";

const KEY_NAME = "openclaw_studio_ed25519";
const KEY_DIR = path.join(os.homedir(), ".ssh");
const KEY_PATH = path.join(KEY_DIR, KEY_NAME);
const PUB_KEY_PATH = `${KEY_PATH}.pub`;

/**
 * POST: Run full SSH diagnostic against a target host.
 * Returns detailed info about key state, SSH verbose output, etc.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ipAddress, sshUser, sshPort } = body as {
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
  };

  const host = ipAddress?.trim();
  if (!host) {
    return NextResponse.json({ error: "ipAddress required" }, { status: 400 });
  }

  const diag: Record<string, unknown> = {};

  // 1. Check local key files
  diag.keyPath = KEY_PATH;
  diag.privateKeyExists = fs.existsSync(KEY_PATH);
  diag.publicKeyExists = fs.existsSync(PUB_KEY_PATH);
  if (diag.publicKeyExists) {
    diag.publicKeyContent = fs.readFileSync(PUB_KEY_PATH, "utf8").trim();
  }
  if (diag.privateKeyExists) {
    const stat = fs.statSync(KEY_PATH);
    diag.privateKeyPermissions = `0${(stat.mode & 0o777).toString(8)}`;
    diag.privateKeySize = stat.size;
  }

  // 2. Check what ~/.ssh directory looks like
  try {
    const files = fs.readdirSync(KEY_DIR);
    diag.sshDirFiles = files.filter(f => f.includes("openclaw") || f.includes("known_hosts") || f === "config");
  } catch {
    diag.sshDirFiles = "Cannot read ~/.ssh";
  }

  // 3. Verbose SSH connection test (just `exit 0`, not the full scan)
  const user = sshUser || "root";
  const target = `${user}@${host}`;
  const sshArgs = [
    "-v", // VERBOSE
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=no",
    "-o", "ConnectTimeout=10",
  ];
  if (diag.privateKeyExists) {
    sshArgs.push("-i", KEY_PATH);
  }
  if (sshPort && sshPort !== 22) {
    sshArgs.push("-p", String(sshPort));
  }
  sshArgs.push(target, "echo", "SSH_OK");

  diag.sshCommand = `ssh ${sshArgs.join(" ")}`;

  const result = childProcess.spawnSync("ssh", sshArgs, {
    encoding: "utf8",
    timeout: 15_000,
  });

  diag.sshExitCode = result.status;
  diag.sshStdout = result.stdout?.trim() ?? "";
  // SSH verbose output goes to stderr
  const stderr = result.stderr ?? "";
  // Extract the key lines from verbose output
  const verboseLines = stderr.split("\n").filter(line =>
    line.includes("identity file") ||
    line.includes("Offering") ||
    line.includes("Trying") ||
    line.includes("Authentication") ||
    line.includes("identity") ||
    line.includes("publickey") ||
    line.includes("Permission") ||
    line.includes("Server accepts") ||
    line.includes("Next authentication") ||
    line.includes("Will attempt") ||
    line.includes("Authenticated")
  );
  diag.sshVerbose = verboseLines;
  diag.sshFullStderr = stderr.slice(0, 3000);

  return NextResponse.json(diag);
}
