/**
 * OpenClaw config generation — ported from Agency-AI provision-openclaw.ts.
 *
 * Produces openclaw.json and auth-profiles.json structures matching the
 * exact format expected by OpenClaw gateway (ghcr.io/openclaw/openclaw).
 *
 * Key differences from Agency-AI:
 * - Settings come from Convex (systemSettings + providerCredentials) not SQLite
 * - All Docker deployments use fixed mount path /home/node/.openclaw
 * - Profile key uses "studio" suffix instead of "agency"
 * - No local/remote paths — Studio always deploys Docker on remote VPS
 */

// ── Types ─────────────────────────────────────────────────

export interface ConfigInput {
  instanceName: string;
  port: number;
  model: { primary: string; fallbacks: string[] };
  authToken: string;
  /** Provider credentials from Convex (decrypted values) */
  credentials: { provider: string; key: string; value: string }[];
  /** Agent-level system settings from Convex */
  settings: Record<string, string>;
  /** Brain files for workspace */
  brainFiles?: { name: string; content: string }[];
  /** Agent identity */
  agentIdentity?: { name: string; email?: string; gender?: string };
}

// ── Model resolution — ported from Agency-AI ──────────────

const MODEL_PROVIDERS: Record<string, string> = {
  claude: "anthropic",
  "gpt-": "openai",
  o1: "openai",
  o3: "openai",
  "chatgpt-": "openai",
  gemini: "google",
  kimi: "kimi",
  glm: "zai",
  minimax: "minimax",
};

function resolveModelId(modelId: string): string {
  if (modelId.includes("/")) return modelId;
  for (const [prefix, provider] of Object.entries(MODEL_PROVIDERS)) {
    if (modelId.startsWith(prefix)) return `${provider}/${modelId}`;
  }
  return `anthropic/${modelId}`;
}

// ── Credential helpers ────────────────────────────────────

/** Map provider credentials to { providerSlug: apiKey } */
function credentialMap(
  credentials: ConfigInput["credentials"],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of credentials) {
    // key format: "ai.anthropic_api_key" or provider slug already
    if (c.key.includes("api_key") || c.key.includes("apikey")) {
      map[c.provider] = c.value;
    }
  }
  return map;
}

// ── buildOpenClawJson ─────────────────────────────────────

export function buildOpenClawJson(
  input: ConfigInput,
): Record<string, unknown> {
  const s = input.settings;
  const creds = credentialMap(input.credentials);

  // Docker workspace path (fixed mount)
  const workspace = "/home/node/.openclaw/workspace";

  // Agent defaults — mirrors Agency-AI structure exactly
  const defaults: Record<string, unknown> = {
    workspace,
    model: {
      primary: resolveModelId(input.model.primary),
      ...(input.model.fallbacks.length > 0
        ? { fallbacks: input.model.fallbacks.map(resolveModelId) }
        : {}),
    },
    thinkingDefault: s["agent.thinking"] || "low",
    timeoutSeconds: Number(s["agent.timeout_seconds"]) || 600,
    maxConcurrent: Number(s["agent.max_concurrent"]) || 1,
    sandbox: {
      mode: s["agent.sandbox_mode"] || "non-main",
      scope: s["agent.sandbox_scope"] || "agent",
    },
    heartbeat: { every: s["agent.heartbeat_interval"] || "30m" },
    verboseDefault: "off",
  };

  // Compaction — same 3 modes as Agency-AI
  const compactionMode = s["agent.compaction"] || "default";
  if (compactionMode === "default") {
    defaults.compaction = {
      reserveTokensFloor: 20000,
      memoryFlush: { enabled: true, softThresholdTokens: 4000 },
    };
  } else if (compactionMode === "aggressive") {
    defaults.compaction = {
      reserveTokensFloor: 10000,
      memoryFlush: { enabled: true, softThresholdTokens: 2000 },
    };
  }
  // "off" → omit compaction entirely

  // Context pruning
  const pruningMode = s["agent.context_pruning"];
  if (pruningMode === "off" || pruningMode === "cache-ttl") {
    defaults.contextPruning = { mode: pruningMode };
  }

  // Tools — same structure as Agency-AI
  const tools: Record<string, unknown> = {
    profile: s["agent.tools_profile"] || "full",
    web: {
      search: { enabled: s["agent.web_search"] !== "false" },
      fetch: {
        enabled: true,
        maxChars: 50000,
        timeoutSeconds: 30,
        cacheTtlMinutes: 15,
      },
    },
    exec: { timeoutSec: Number(s["agent.exec_timeout_sec"]) || 1800 },
  };

  // Audio transcription (requires OpenAI key)
  if (creds["openai"]) {
    tools.media = {
      audio: {
        enabled: true,
        maxBytes: 20971520,
        models: [{ provider: "openai", model: "gpt-4o-mini-transcribe" }],
      },
    };
  }

  if (s["agent.tools_allow"]) {
    tools.allow = s["agent.tools_allow"]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (s["agent.tools_deny"]) {
    tools.deny = s["agent.tools_deny"]
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // Env vars — pass provider API keys
  const envVars: Record<string, string> = {};
  if (creds["openai"]) envVars.OPENAI_API_KEY = creds["openai"];
  if (creds["elevenlabs"]) envVars.ELEVENLABS_API_KEY = creds["elevenlabs"];

  const config: Record<string, unknown> = {
    agents: {
      defaults,
      list: [
        { id: "main" },
        { id: input.instanceName, name: input.instanceName, workspace },
      ],
    },
    tools,
    browser: { enabled: s["agent.browser_enabled"] !== "false" },
    logging: {
      level: s["agent.logging_level"] || "info",
      redactSensitive: s["agent.logging_redact"] || "tools",
    },
    gateway: {
      mode: "local",
      port: input.port,
      bind: "lan",
      controlUi: { allowInsecureAuth: true },
      auth: {
        mode: "token",
        token: input.authToken,
      },
    },
    commands: { native: "auto", restart: true },
    env: { vars: envVars },
  };

  // TTS configuration — same structure as Agency-AI
  const ttsProvider = s["ai.tts_provider"] || "disabled";
  if (ttsProvider !== "disabled") {
    const tts: Record<string, unknown> = {
      auto: s["ai.tts_auto"] || "inbound",
      provider: ttsProvider,
    };

    if (ttsProvider === "openai") {
      tts.openai = {
        model: s["ai.tts_openai_model"] || "gpt-4o-mini-tts",
        voice: s["ai.tts_openai_voice"] || "alloy",
      };
    } else if (ttsProvider === "elevenlabs") {
      tts.elevenlabs = {
        voiceId: s["ai.elevenlabs_voice_id"] || "",
        modelId: s["ai.elevenlabs_model"] || "eleven_multilingual_v2",
        voiceSettings: {
          stability: parseFloat(s["ai.elevenlabs_stability"] || "0.5"),
          similarityBoost: parseFloat(s["ai.elevenlabs_similarity"] || "0.75"),
        },
      };
    }

    config.messages = { tts };
  }

  return config;
}

// ── buildAuthProfilesJson ─────────────────────────────────

/**
 * Build auth-profiles.json from provider credentials.
 * Profile key uses "{provider}:studio" (Agency-AI uses "{provider}:agency").
 */
export function buildAuthProfilesJson(
  credentials: ConfigInput["credentials"],
): Record<string, unknown> {
  const authFile: {
    version: number;
    profiles: Record<string, unknown>;
    lastGood: Record<string, string>;
    usageStats: Record<string, unknown>;
  } = {
    version: 1,
    profiles: {},
    lastGood: {},
    usageStats: {},
  };

  const creds = credentialMap(credentials);

  // Anthropic
  if (creds["anthropic"]) {
    authFile.profiles["anthropic:studio"] = {
      type: "token",
      provider: "anthropic",
      token: creds["anthropic"],
    };
    authFile.lastGood["anthropic"] = "anthropic:studio";
  }

  // OpenAI
  if (creds["openai"]) {
    authFile.profiles["openai:studio"] = {
      type: "token",
      provider: "openai",
      token: creds["openai"],
    };
    authFile.lastGood["openai"] = "openai:studio";
  }

  // Google (Gemini)
  if (creds["google"]) {
    authFile.profiles["google:studio"] = {
      type: "token",
      provider: "google",
      token: creds["google"],
    };
    authFile.lastGood["google"] = "google:studio";
  }

  // Kimi (Moonshot)
  if (creds["kimi"]) {
    authFile.profiles["kimi:studio"] = {
      type: "token",
      provider: "kimi",
      token: creds["kimi"],
    };
    authFile.lastGood["kimi"] = "kimi:studio";
  }

  // Z.AI (GLM)
  if (creds["zai"]) {
    authFile.profiles["zai:studio"] = {
      type: "token",
      provider: "zai",
      token: creds["zai"],
    };
    authFile.lastGood["zai"] = "zai:studio";
  }

  // MiniMax
  if (creds["minimax"]) {
    authFile.profiles["minimax:studio"] = {
      type: "token",
      provider: "minimax",
      token: creds["minimax"],
    };
    authFile.lastGood["minimax"] = "minimax:studio";
  }

  if (Object.keys(authFile.profiles).length === 0) {
    throw new Error(
      "No auth credentials available. Configure API keys in Settings.",
    );
  }

  return authFile;
}
