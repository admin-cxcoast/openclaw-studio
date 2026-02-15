import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireSuperAdmin } from "./lib/authorization";
import type { Id } from "./_generated/dataModel";

// ── Queries ──────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("models").collect();
  },
});

export const listByProvider = query({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    return ctx.db
      .query("models")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();
  },
});

// ── Mutations ────────────────────────────────────────────

export const create = mutation({
  args: {
    providerId: v.id("providers"),
    modelId: v.string(),
    name: v.string(),
    capabilities: v.optional(
      v.object({
        reasoning: v.optional(v.boolean()),
        vision: v.optional(v.boolean()),
        toolCalling: v.optional(v.boolean()),
        streaming: v.optional(v.boolean()),
      }),
    ),
    contextWindow: v.optional(v.number()),
    maxOutputTokens: v.optional(v.number()),
    costPer1kInput: v.optional(v.number()),
    costPer1kOutput: v.optional(v.number()),
    isEnabled: v.boolean(),
    isDefault: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("models")
      .withIndex("by_providerId_modelId", (q) =>
        q.eq("providerId", args.providerId).eq("modelId", args.modelId),
      )
      .unique();
    if (existing) throw new Error("Model already exists for this provider");
    return ctx.db.insert("models", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("models"),
    name: v.optional(v.string()),
    capabilities: v.optional(
      v.object({
        reasoning: v.optional(v.boolean()),
        vision: v.optional(v.boolean()),
        toolCalling: v.optional(v.boolean()),
        streaming: v.optional(v.boolean()),
      }),
    ),
    contextWindow: v.optional(v.number()),
    maxOutputTokens: v.optional(v.number()),
    costPer1kInput: v.optional(v.number()),
    costPer1kOutput: v.optional(v.number()),
    isEnabled: v.optional(v.boolean()),
    isDefault: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("models") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ── Internal helpers for syncCatalog action ──────────────

/** Get enabled providers with their API keys (internal only). */
export const _getProvidersWithKeys = internalQuery({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    const results: {
      _id: Id<"providers">;
      slug: string;
      name: string;
      type: string;
      baseUrl?: string;
      apiKey: string;
    }[] = [];

    for (const p of providers) {
      if (!p.isEnabled) continue;
      const cred = await ctx.db
        .query("providerCredentials")
        .withIndex("by_providerId", (q) => q.eq("providerId", p._id))
        .first();
      if (!cred) continue;
      results.push({
        _id: p._id,
        slug: p.slug,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        apiKey: cred.value,
      });
    }
    return results;
  },
});

/** Upsert a model from API fetch (internal only). */
export const _upsertModel = internalMutation({
  args: {
    providerId: v.id("providers"),
    modelId: v.string(),
    name: v.string(),
    contextWindow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("models")
      .withIndex("by_providerId_modelId", (q) =>
        q.eq("providerId", args.providerId).eq("modelId", args.modelId),
      )
      .unique();
    if (existing) return false;
    await ctx.db.insert("models", {
      providerId: args.providerId,
      modelId: args.modelId,
      name: args.name,
      contextWindow: args.contextWindow,
      isEnabled: true,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// ── Provider API fetchers ────────────────────────────────

type FetchedModel = { id: string; name: string; contextWindow?: number };

const DEFAULT_API_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  google: "https://generativelanguage.googleapis.com",
  kimi: "https://api.moonshot.cn",
  zai: "https://api.x.ai",
  minimax: "https://api.minimax.chat",
};

async function fetchOpenAIModels(
  apiKey: string,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  const url = `${baseUrl || DEFAULT_API_URLS.openai}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string; owned_by?: string }[] };
  return data.data
    .filter((m) => !m.id.includes("realtime") && !m.id.includes("audio") && !m.id.includes("embedding") && !m.id.includes("moderation") && !m.id.includes("dall-e") && !m.id.includes("whisper") && !m.id.includes("davinci") && !m.id.includes("babbage"))
    .map((m) => ({ id: m.id, name: m.id }));
}

async function fetchAnthropicModels(
  apiKey: string,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  const url = `${baseUrl || DEFAULT_API_URLS.anthropic}/v1/models`;
  const res = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string; display_name?: string }[] };
  return data.data.map((m) => ({
    id: m.id,
    name: m.display_name || m.id,
  }));
}

async function fetchGoogleModels(
  apiKey: string,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  const base = baseUrl || DEFAULT_API_URLS.google;
  const url = `${base}/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    models: {
      name: string;
      displayName: string;
      inputTokenLimit?: number;
    }[];
  };
  return data.models
    .filter((m) => m.name.includes("gemini"))
    .map((m) => ({
      id: m.name.replace("models/", ""),
      name: m.displayName || m.name,
      contextWindow: m.inputTokenLimit,
    }));
}

async function fetchOpenAICompatibleModels(
  apiKey: string,
  baseUrl: string,
): Promise<FetchedModel[]> {
  const url = `${baseUrl}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string }[] };
  return data.data.map((m) => ({ id: m.id, name: m.id }));
}

async function fetchModelsForProvider(
  slug: string,
  apiKey: string,
  baseUrl?: string,
): Promise<FetchedModel[]> {
  switch (slug) {
    case "openai":
      return fetchOpenAIModels(apiKey, baseUrl);
    case "anthropic":
      return fetchAnthropicModels(apiKey, baseUrl);
    case "google":
      return fetchGoogleModels(apiKey, baseUrl);
    case "kimi":
      return fetchOpenAICompatibleModels(apiKey, baseUrl || DEFAULT_API_URLS.kimi);
    case "zai":
      return fetchOpenAICompatibleModels(apiKey, baseUrl || DEFAULT_API_URLS.zai);
    case "minimax":
      return fetchOpenAICompatibleModels(apiKey, baseUrl || DEFAULT_API_URLS.minimax);
    default:
      // Try OpenAI-compatible as fallback if baseUrl is set
      if (baseUrl) return fetchOpenAICompatibleModels(apiKey, baseUrl);
      return [];
  }
}

// ── Public sync action ───────────────────────────────────

/** Fetch models from provider APIs and save to database. */
export const syncCatalog = action({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.runQuery(internal.models._getProvidersWithKeys);
    let added = 0;
    const errors: string[] = [];

    for (const provider of providers) {
      // Skip TTS providers — they don't have a /models endpoint
      if (provider.type === "tts" || provider.type === "stt" || provider.type === "image") continue;

      try {
        const models = await fetchModelsForProvider(
          provider.slug,
          provider.apiKey,
          provider.baseUrl,
        );
        for (const model of models) {
          const wasAdded = await ctx.runMutation(internal.models._upsertModel, {
            providerId: provider._id,
            modelId: model.id,
            name: model.name,
            contextWindow: model.contextWindow,
          });
          if (wasAdded) added++;
        }
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { added, errors };
  },
});
