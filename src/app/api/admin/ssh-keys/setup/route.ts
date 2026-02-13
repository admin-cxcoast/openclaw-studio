import { NextResponse } from "next/server";
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
 * GET: Check if SSH key exists, return public key if so
 * POST: Generate SSH key pair if not exists, return public key
 */

export async function GET() {
  try {
    if (fs.existsSync(PUB_KEY_PATH)) {
      const publicKey = fs.readFileSync(PUB_KEY_PATH, "utf8").trim();
      return NextResponse.json({
        exists: true,
        publicKey,
        keyPath: KEY_PATH,
      });
    }
    return NextResponse.json({ exists: false, publicKey: null, keyPath: KEY_PATH });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to check SSH key" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    // Ensure ~/.ssh directory exists
    if (!fs.existsSync(KEY_DIR)) {
      fs.mkdirSync(KEY_DIR, { mode: 0o700, recursive: true });
    }

    // Check if key already exists
    if (fs.existsSync(KEY_PATH)) {
      const publicKey = fs.readFileSync(PUB_KEY_PATH, "utf8").trim();
      return NextResponse.json({
        created: false,
        publicKey,
        keyPath: KEY_PATH,
        message: "SSH key already exists",
      });
    }

    // Generate ED25519 key pair
    const result = childProcess.spawnSync(
      "ssh-keygen",
      [
        "-t", "ed25519",
        "-f", KEY_PATH,
        "-N", "",  // no passphrase
        "-C", "openclaw-studio-admin",
      ],
      { encoding: "utf8", timeout: 10_000 },
    );

    if (result.error) {
      return NextResponse.json(
        { error: `ssh-keygen failed: ${result.error.message}` },
        { status: 500 },
      );
    }

    if (result.status !== 0) {
      return NextResponse.json(
        { error: `ssh-keygen failed: ${result.stderr?.trim() || "Unknown error"}` },
        { status: 500 },
      );
    }

    // Set correct permissions
    fs.chmodSync(KEY_PATH, 0o600);

    const publicKey = fs.readFileSync(PUB_KEY_PATH, "utf8").trim();
    return NextResponse.json({
      created: true,
      publicKey,
      keyPath: KEY_PATH,
      message: "SSH key pair generated",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate SSH key" },
      { status: 500 },
    );
  }
}
