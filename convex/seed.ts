import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const seedSuperAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: "superAdmin",
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("userProfiles", {
      userId: args.userId,
      role: "superAdmin",
      updatedAt: Date.now(),
    });
  },
});

export const seedDefaultProviders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      { slug: "anthropic", name: "Anthropic", type: "llm" as const, sortOrder: 1 },
      { slug: "openai", name: "OpenAI", type: "llm" as const, sortOrder: 2 },
      { slug: "google", name: "Google", type: "llm" as const, sortOrder: 3 },
      { slug: "kimi", name: "Kimi (Moonshot)", type: "llm" as const, sortOrder: 4 },
      { slug: "zai", name: "Z.AI", type: "llm" as const, sortOrder: 5 },
      { slug: "minimax", name: "MiniMax", type: "llm" as const, sortOrder: 6 },
      { slug: "openai-tts", name: "OpenAI TTS", type: "tts" as const, sortOrder: 10 },
      { slug: "elevenlabs", name: "ElevenLabs", type: "tts" as const, sortOrder: 11 },
    ];
    for (const p of defaults) {
      const existing = await ctx.db
        .query("providers")
        .withIndex("by_slug", (q) => q.eq("slug", p.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("providers", {
          ...p,
          isEnabled: true,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const seedDefaultSettings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const defaults = [
      {
        key: "app_name",
        value: "OpenClaw Studio",
        category: "general" as const,
        description: "Application display name",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "default_model",
        value: "claude-sonnet-4-5-20250929",
        category: "ai" as const,
        description: "Default AI model for new agents",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "hostinger_api_key",
        value: "",
        category: "vps" as const,
        description: "Hostinger API key for VPS management",
        sensitive: true,
        inputType: "password",
      },
      {
        key: "hostinger_api_url",
        value: "https://developers.hostinger.com",
        category: "vps" as const,
        description: "Hostinger API base URL",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "max_orgs",
        value: "100",
        category: "general" as const,
        description: "Maximum number of organizations allowed",
        sensitive: false,
        inputType: "number",
      },
      // ── TTS Settings ──────────────────────────────────────
      {
        key: "ai.tts_provider",
        value: "disabled",
        category: "ai" as const,
        description: "TTS provider for voice output",
        sensitive: false,
        inputType: "select:disabled,openai,elevenlabs",
      },
      {
        key: "ai.tts_auto",
        value: "inbound",
        category: "ai" as const,
        description: "When to auto-generate voice: off, inbound (reply to voice only), always",
        sensitive: false,
        inputType: "select:off,inbound,always",
      },
      {
        key: "ai.tts_openai_model",
        value: "gpt-4o-mini-tts",
        category: "ai" as const,
        description: "OpenAI TTS model",
        sensitive: false,
        inputType: "select:gpt-4o-mini-tts,tts-1-hd,tts-1",
      },
      {
        key: "ai.tts_openai_voice",
        value: "alloy",
        category: "ai" as const,
        description: "OpenAI voice",
        sensitive: false,
        inputType: "select:alloy,ash,ballad,coral,echo,fable,nova,onyx,sage,shimmer,verse,marin,cedar",
      },
      {
        key: "ai.tts_openai_speed",
        value: "1.0",
        category: "ai" as const,
        description: "Speech speed (0.25 to 4.0)",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "ai.elevenlabs_api_key",
        value: "",
        category: "ai" as const,
        description: "ElevenLabs API key",
        sensitive: true,
        inputType: "password",
      },
      {
        key: "ai.elevenlabs_model",
        value: "eleven_multilingual_v2",
        category: "ai" as const,
        description: "ElevenLabs model",
        sensitive: false,
        inputType: "select:eleven_v3,eleven_multilingual_v2,eleven_turbo_v2_5,eleven_flash_v2_5",
      },
      {
        key: "ai.elevenlabs_voice_id",
        value: "",
        category: "ai" as const,
        description: "ElevenLabs voice ID (from dashboard)",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "ai.elevenlabs_stability",
        value: "0.5",
        category: "ai" as const,
        description: "Voice stability (0–1, higher = more consistent)",
        sensitive: false,
        inputType: "text",
      },
      {
        key: "ai.elevenlabs_similarity",
        value: "0.75",
        category: "ai" as const,
        description: "Similarity boost (0–1, higher = closer to original)",
        sensitive: false,
        inputType: "text",
      },
    ];
    for (const s of defaults) {
      const existing = await ctx.db
        .query("systemSettings")
        .withIndex("by_key", (q) => q.eq("key", s.key))
        .unique();
      if (!existing) {
        await ctx.db.insert("systemSettings", {
          ...s,
          updatedAt: Date.now(),
        });
      }
    }
  },
});
