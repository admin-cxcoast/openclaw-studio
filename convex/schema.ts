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
        maxInstances: v.optional(v.number()),
        enabledSkillCategories: v.optional(v.array(v.string())),
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
    primaryAgentName: v.optional(v.string()),
    lastScanAt: v.optional(v.number()),
    deploymentId: v.optional(v.id("deployments")),
    configSnapshot: v.optional(v.string()),
    skillCount: v.optional(v.number()),
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
  // Skills catalog (globally managed by super admin)
  // ──────────────────────────────────────────────
  skills: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("mcp"),
      v.literal("prompt"),
      v.literal("workflow"),
    ),
    sourceRepo: v.optional(v.string()),
    content: v.string(),
    entryPoint: v.optional(v.string()),
    runtime: v.optional(
      v.union(
        v.literal("node"),
        v.literal("python"),
        v.literal("none"),
      ),
    ),
    dependencies: v.optional(v.string()),
    envKeys: v.optional(
      v.array(
        v.object({
          key: v.string(),
          description: v.string(),
          required: v.boolean(),
        }),
      ),
    ),
    isEnabled: v.boolean(),
    plans: v.array(v.string()),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_category", ["category"])
    .index("by_isEnabled", ["isEnabled"]),

  // ──────────────────────────────────────────────
  // Instance-skill assignments (junction table)
  // ──────────────────────────────────────────────
  instanceSkills: defineTable({
    instanceId: v.id("gatewayInstances"),
    skillId: v.id("skills"),
    deployedAt: v.number(),
  })
    .index("by_instanceId", ["instanceId"])
    .index("by_skillId", ["skillId"])
    .index("by_instanceId_skillId", ["instanceId", "skillId"]),

  // ──────────────────────────────────────────────
  // Skill environment values (org-scoped secrets per skill)
  // ──────────────────────────────────────────────
  skillEnvValues: defineTable({
    skillId: v.id("skills"),
    orgId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  })
    .index("by_skillId", ["skillId"])
    .index("by_orgId", ["orgId"])
    .index("by_skillId_orgId", ["skillId", "orgId"])
    .index("by_orgId_skillId_key", ["orgId", "skillId", "key"]),

  // ──────────────────────────────────────────────
  // Knowledge base (org-scoped)
  // ──────────────────────────────────────────────
  knowledge: defineTable({
    orgId: v.id("organizations"),
    key: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    source: v.union(v.literal("human"), v.literal("agent")),
    sourceAgentId: v.optional(v.string()),
    sourceInstanceId: v.optional(v.id("gatewayInstances")),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_key", ["orgId", "key"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["orgId"],
    }),

  // ──────────────────────────────────────────────
  // Knowledge proposals (agent-authored, awaiting approval)
  // ──────────────────────────────────────────────
  knowledgeProposals: defineTable({
    orgId: v.id("organizations"),
    instanceId: v.id("gatewayInstances"),
    agentId: v.string(),
    key: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_orgId_status", ["orgId", "status"])
    .index("by_instanceId", ["instanceId"]),

  // ──────────────────────────────────────────────
  // Documents (org-scoped, optionally linked to instance)
  // ──────────────────────────────────────────────
  documents: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    content: v.string(),
    docType: v.union(
      v.literal("general"),
      v.literal("spec"),
      v.literal("runbook"),
      v.literal("reference"),
    ),
    instanceId: v.optional(v.id("gatewayInstances")),
    tags: v.array(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    // ── File attachment (optional) ──
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_orgId_docType", ["orgId", "docType"])
    .index("by_instanceId", ["instanceId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["orgId"],
    }),

  // ──────────────────────────────────────────────
  // Org-to-VPS access assignments (authorization + quota)
  // ──────────────────────────────────────────────
  orgVpsAccess: defineTable({
    orgId: v.id("organizations"),
    vpsId: v.id("vpsInstances"),
    maxInstances: v.number(),
    assignedBy: v.id("users"),
    assignedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_vpsId", ["vpsId"])
    .index("by_orgId_vpsId", ["orgId", "vpsId"]),

  // ──────────────────────────────────────────────
  // Deployments (provisioning lifecycle — real-time step tracking)
  // Mirrors Agency-AI DeploymentState + DeploymentStep types
  // ──────────────────────────────────────────────
  deployments: defineTable({
    orgId: v.id("organizations"),
    vpsId: v.id("vpsInstances"),
    instanceName: v.string(),
    config: v.object({
      model: v.object({
        primary: v.string(),
        fallbacks: v.array(v.string()),
      }),
      skillIds: v.array(v.id("skills")),
      brainFiles: v.array(
        v.object({ name: v.string(), content: v.string() }),
      ),
      roleTemplate: v.optional(v.string()),
      agentIdentity: v.optional(
        v.object({
          name: v.string(),
          email: v.optional(v.string()),
          gender: v.optional(v.string()),
        }),
      ),
      gatewayAuth: v.object({
        mode: v.literal("token"),
        token: v.string(),
      }),
    }),
    port: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    steps: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("success"),
          v.literal("failed"),
          v.literal("skipped"),
        ),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        error: v.optional(v.string()),
      }),
    ),
    gatewayInstanceId: v.optional(v.id("gatewayInstances")),
    error: v.optional(v.string()),
    createdBy: v.id("users"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_vpsId", ["vpsId"])
    .index("by_status", ["status"])
    .index("by_orgId_status", ["orgId", "status"]),

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
