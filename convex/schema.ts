import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // ──────────────────────────────────────────────
  // Extended user profile (separate from auth users table)
  // ──────────────────────────────────────────────
  userProfiles: defineTable({
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("superAdmin"),
      v.literal("orgAdmin"),
      v.literal("member"),
    ),
    avatarUrl: v.optional(v.string()),
    lastLoginAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"]),

  // ──────────────────────────────────────────────
  // Organizations (tenants)
  // ──────────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    plan: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro"),
      v.literal("enterprise"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("archived"),
    ),
    settings: v.optional(
      v.object({
        maxAgents: v.optional(v.number()),
        maxVps: v.optional(v.number()),
        features: v.optional(v.array(v.string())),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // ──────────────────────────────────────────────
  // Organization membership (user <-> org mapping)
  // ──────────────────────────────────────────────
  orgMembers: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
    joinedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_userId", ["userId"])
    .index("by_orgId_userId", ["orgId", "userId"]),

  // ──────────────────────────────────────────────
  // VPS instances (physical servers)
  // ──────────────────────────────────────────────
  vpsInstances: defineTable({
    hostingerId: v.optional(v.string()),
    hostname: v.string(),
    ipAddress: v.string(),
    region: v.optional(v.string()),
    plan: v.optional(v.string()),
    maxInstances: v.optional(v.number()),
    status: v.union(
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("unassigned"), // deprecated — kept for migration
    ),
    sshUser: v.optional(v.string()),
    sshPort: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    lastHealthCheck: v.optional(v.number()),
    updatedAt: v.number(),
    // ── Deprecated fields (kept for migration, will be removed) ──
    orgId: v.optional(v.id("organizations")),
    gatewayPort: v.optional(v.number()),
    gatewayUrl: v.optional(v.string()),
    gatewayToken: v.optional(v.string()),
  })
    .index("by_hostingerId", ["hostingerId"])
    .index("by_orgId", ["orgId"])
    .index("by_status", ["status"]),

  // ──────────────────────────────────────────────
  // Gateway instances (OpenClaw instances on VPS — junction table)
  // One VPS can host many instances, one org can use many instances
  // ──────────────────────────────────────────────
  gatewayInstances: defineTable({
    vpsId: v.id("vpsInstances"),
    orgId: v.id("organizations"),
    name: v.string(),
    port: v.number(),
    token: v.optional(v.string()),
    url: v.optional(v.string()),
    stateDir: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("unknown"),
    ),
    agentCount: v.optional(v.number()),
    lastScanAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_vpsId", ["vpsId"])
    .index("by_orgId", ["orgId"])
    .index("by_vpsId_orgId", ["vpsId", "orgId"]),

  // ──────────────────────────────────────────────
  // AI providers (system-wide definitions)
  // ──────────────────────────────────────────────
  providers: defineTable({
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
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_type", ["type"]),

  // ──────────────────────────────────────────────
  // Provider credentials (API keys -- per-org or system-level)
  // ──────────────────────────────────────────────
  providerCredentials: defineTable({
    providerId: v.id("providers"),
    orgId: v.optional(v.id("organizations")),
    key: v.string(),
    value: v.string(),
    sensitive: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_providerId", ["providerId"])
    .index("by_orgId", ["orgId"])
    .index("by_providerId_orgId", ["providerId", "orgId"]),

  // ──────────────────────────────────────────────
  // AI models catalog
  // ──────────────────────────────────────────────
  models: defineTable({
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
    updatedAt: v.number(),
  })
    .index("by_providerId", ["providerId"])
    .index("by_modelId", ["modelId"])
    .index("by_providerId_modelId", ["providerId", "modelId"]),

  // ──────────────────────────────────────────────
  // System settings (key-value, category-based)
  // ──────────────────────────────────────────────
  systemSettings: defineTable({
    key: v.string(),
    value: v.string(),
    category: v.union(
      v.literal("general"),
      v.literal("ai"),
      v.literal("agent"),
      v.literal("identity"),
      v.literal("vps"),
      v.literal("security"),
    ),
    description: v.optional(v.string()),
    sensitive: v.boolean(),
    inputType: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_category", ["category"]),
});
