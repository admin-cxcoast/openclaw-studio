/**
 * Model metadata catalog — known context windows & capabilities per model ID.
 * Used as an enrichment layer when dynamically fetching models from provider APIs.
 * Provider APIs return model IDs but rarely include context window or capability info.
 */

export type ModelMeta = {
  name?: string;
  contextWindow?: number;
  capabilities?: {
    reasoning?: boolean;
    vision?: boolean;
    toolCalling?: boolean;
    streaming?: boolean;
  };
};

/** Lookup by modelId (provider-agnostic). */
const META: Record<string, ModelMeta> = {
  // ── Anthropic ──────────────────────────────────────────
  "claude-opus-4-6": { name: "Claude Opus 4.6", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "claude-opus-4-5-20250924": { name: "Claude Opus 4.5", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "claude-sonnet-4-5-20250929": { name: "Claude Sonnet 4.5", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "claude-haiku-4-5-20251001": { name: "Claude Haiku 4.5", contextWindow: 200000, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "claude-3-5-sonnet-20241022": { name: "Claude 3.5 Sonnet", contextWindow: 200000, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "claude-3-5-haiku-20241022": { name: "Claude 3.5 Haiku", contextWindow: 200000, capabilities: { toolCalling: true, streaming: true } },
  "claude-3-opus-20240229": { name: "Claude 3 Opus", contextWindow: 200000, capabilities: { vision: true, toolCalling: true, streaming: true } },

  // ── OpenAI ─────────────────────────────────────────────
  "gpt-4.1": { name: "GPT-4.1", contextWindow: 1047576, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "gpt-4.1-mini": { name: "GPT-4.1 Mini", contextWindow: 1047576, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gpt-4.1-nano": { name: "GPT-4.1 Nano", contextWindow: 1047576, capabilities: { toolCalling: true, streaming: true } },
  "gpt-4o": { name: "GPT-4o", contextWindow: 128000, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gpt-4o-mini": { name: "GPT-4o Mini", contextWindow: 128000, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gpt-4-turbo": { name: "GPT-4 Turbo", contextWindow: 128000, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gpt-4": { name: "GPT-4", contextWindow: 8192, capabilities: { toolCalling: true, streaming: true } },
  "gpt-4-0613": { name: "GPT-4 (0613)", contextWindow: 8192, capabilities: { toolCalling: true, streaming: true } },
  "gpt-3.5-turbo": { name: "GPT-3.5 Turbo", contextWindow: 16385, capabilities: { toolCalling: true, streaming: true } },
  "o3": { name: "o3", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "o3-pro": { name: "o3 Pro", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "o3-mini": { name: "o3 Mini", contextWindow: 200000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "o4-mini": { name: "o4 Mini", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "o1": { name: "o1", contextWindow: 200000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "o1-mini": { name: "o1 Mini", contextWindow: 128000, capabilities: { reasoning: true, streaming: true } },

  // ── Google ─────────────────────────────────────────────
  "gemini-3.0-pro": { contextWindow: 1048576, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "gemini-3.0-flash": { contextWindow: 1048576, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "gemini-2.5-pro": { contextWindow: 1048576, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "gemini-2.5-flash": { contextWindow: 1048576, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gemini-2.0-flash": { contextWindow: 1048576, capabilities: { vision: true, toolCalling: true, streaming: true } },
  "gemini-2.0-flash-lite": { contextWindow: 1048576, capabilities: { streaming: true } },

  // ── Kimi (Moonshot) ────────────────────────────────────
  "kimi-k2.5": { contextWindow: 256000, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "kimi-k2-thinking": { contextWindow: 256000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "kimi-k2": { contextWindow: 256000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "moonshot-v1-128k": { contextWindow: 128000, capabilities: { toolCalling: true, streaming: true } },
  "moonshot-v1-32k": { contextWindow: 32000, capabilities: { toolCalling: true, streaming: true } },
  "moonshot-v1-8k": { contextWindow: 8000, capabilities: { toolCalling: true, streaming: true } },

  // ── xAI (Grok) ─────────────────────────────────────────
  "grok-4": { contextWindow: 131072, capabilities: { reasoning: true, vision: true, toolCalling: true, streaming: true } },
  "grok-3": { contextWindow: 131072, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "grok-3-mini": { contextWindow: 131072, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "grok-2-1212": { name: "Grok 2", contextWindow: 131072, capabilities: { toolCalling: true, streaming: true } },
  "grok-2-vision-1212": { name: "Grok 2 Vision", contextWindow: 32768, capabilities: { vision: true, streaming: true } },

  // ── MiniMax ────────────────────────────────────────────
  "MiniMax-M2.1": { contextWindow: 1000000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "MiniMax-M2": { contextWindow: 1000000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "MiniMax-M1": { contextWindow: 1000000, capabilities: { reasoning: true, toolCalling: true, streaming: true } },
  "MiniMax-01": { contextWindow: 1000000, capabilities: { toolCalling: true, streaming: true } },
};

/** Look up enrichment metadata for a model ID. */
export function getModelMeta(modelId: string): ModelMeta | undefined {
  return META[modelId];
}
