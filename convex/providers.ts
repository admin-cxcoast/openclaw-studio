import { v } from "convex/values";
import { query, mutation, action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireSuperAdmin } from "./lib/authorization";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return ctx.db.query("providers").collect();
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    type: v.union(
      v.literal("llm"),
      v.literal("tts"),
      v.literal("stt"),
      v.literal("image"),
    ),
    baseUrl: v.optional(v.string()),
    supportsOAuth: v.optional(v.boolean()),
    isEnabled: v.boolean(),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("providers")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Provider slug already exists");
    return ctx.db.insert("providers", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("providers"),
    name: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    supportsOAuth: v.optional(v.boolean()),
    isEnabled: v.optional(v.boolean()),
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
  args: { id: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const creds = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.id))
      .collect();
    for (const c of creds) {
      await ctx.db.delete(c._id);
    }
    const models = await ctx.db
      .query("models")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.id))
      .collect();
    for (const m of models) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ── Internal helpers ─────────────────────────────────────

/** Fetch a single provider with its API key (internal only). */
export const _getProviderWithKey = internalQuery({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    const provider = await ctx.db.get(args.providerId);
    if (!provider) throw new Error("Provider not found");

    const creds = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();

    const apiKeyCred =
      creds.find((c) => c.key === "api_key") ??
      creds.find((c) => c.sensitive) ??
      creds[0];

    if (!apiKeyCred || !apiKeyCred.value || apiKeyCred.value === "********") {
      throw new Error("No API key configured for this provider");
    }

    return {
      slug: provider.slug,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: apiKeyCred.value,
    };
  },
});

// ── Test API key action ──────────────────────────────────

const TEST_API_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  google: "https://generativelanguage.googleapis.com",
  kimi: "https://api.kimi.com/coding",
  zai: "https://api.x.ai",
  minimax: "https://api.minimax.chat",
  "openai-tts": "https://api.openai.com",
  elevenlabs: "https://api.elevenlabs.io",
};

/** Test a provider's API key with a lightweight API call. */
export const testApiKey = action({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const provider = await ctx.runQuery(
      internal.providers._getProviderWithKey,
      { providerId: args.providerId },
    );

    const { slug, type, baseUrl, apiKey } = provider;

    try {
      if (type === "tts") {
        if (slug === "elevenlabs") {
          const url = `${baseUrl || TEST_API_URLS.elevenlabs}/v1/voices`;
          const res = await fetch(url, {
            headers: { "xi-api-key": apiKey },
          });
          if (!res.ok) throw new Error(`ElevenLabs API ${res.status}`);
          return { success: true, message: "ElevenLabs key is valid" };
        }
        if (slug === "openai-tts") {
          const url = `${baseUrl || TEST_API_URLS["openai-tts"]}/v1/models`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
          return { success: true, message: "OpenAI TTS key is valid" };
        }
        return { success: false, message: `No test available for: ${slug}` };
      }

      // LLM providers — use list models endpoint
      let url: string;
      let headers: Record<string, string>;

      switch (slug) {
        case "anthropic":
          url = `${baseUrl || TEST_API_URLS.anthropic}/v1/models`;
          headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
          break;
        case "google":
          url = `${baseUrl || TEST_API_URLS.google}/v1beta/models?key=${apiKey}&pageSize=1`;
          headers = {};
          break;
        default:
          // OpenAI-compatible: openai, kimi, zai, minimax, custom
          url = `${baseUrl || TEST_API_URLS[slug] || ""}/v1/models`;
          headers = { Authorization: `Bearer ${apiKey}` };
          break;
      }

      if (!url || url === "/v1/models") {
        return { success: false, message: `No API URL configured for: ${slug}` };
      }

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
      }

      return { success: true, message: "API key is valid" };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
