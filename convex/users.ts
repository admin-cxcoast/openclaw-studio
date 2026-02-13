import { v } from "convex/values";
import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireSuperAdmin } from "./lib/authorization";
import type { Id } from "./_generated/dataModel";

// ── Public queries/mutations ────────────────────────────

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const user = await ctx.db.get(userId);
    return { user, profile };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").collect();
    const allOrgMembers = await ctx.db.query("orgMembers").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const orgMap = new Map(orgs.map((o) => [o._id, o]));

    const result = [];
    for (const profile of profiles) {
      const user = await ctx.db.get(profile.userId);
      if (!user) continue;

      // Find org memberships for this user
      const memberships = allOrgMembers
        .filter((m) => m.userId === profile.userId)
        .map((m) => ({
          membershipId: m._id,
          orgId: m.orgId,
          orgName: orgMap.get(m.orgId)?.name ?? "Unknown",
          orgSlug: orgMap.get(m.orgId)?.slug ?? "",
          orgRole: m.role,
        }));

      result.push({
        ...profile,
        email: (user as Record<string, unknown>).email ?? null,
        createdAt: user._creationTime,
        memberships,
      });
    }
    return result;
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    await ctx.db.patch(profile._id, updates);
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("superAdmin"),
      v.literal("orgAdmin"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, args) => {
    const { userId: callerId } = await requireSuperAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!profile) throw new Error("User profile not found");

    // Prevent self-demotion
    if (args.userId === callerId && args.role !== "superAdmin") {
      throw new Error("You cannot demote yourself from Super Admin");
    }

    // Prevent demoting the last super admin
    if (profile.role === "superAdmin" && args.role !== "superAdmin") {
      const allSuperAdmins = await ctx.db
        .query("userProfiles")
        .withIndex("by_role", (q) => q.eq("role", "superAdmin"))
        .collect();
      if (allSuperAdmins.length <= 1) {
        throw new Error("Cannot demote the last Super Admin");
      }
    }

    await ctx.db.patch(profile._id, {
      role: args.role,
      updatedAt: Date.now(),
    });
  },
});

// ── Queries for normal authenticated users ────────────

export const getMyOrgs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;

    // SuperAdmins see all orgs
    if (profile.role === "superAdmin") {
      const orgs = await ctx.db.query("organizations").collect();
      return {
        role: profile.role,
        name: profile.name,
        orgs: orgs.map((o) => ({
          orgId: o._id,
          name: o.name,
          slug: o.slug,
          plan: o.plan,
          status: o.status,
          orgRole: "owner" as const,
        })),
      };
    }

    // Normal users see their memberships
    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const orgs = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (!org || org.status !== "active") continue;
      orgs.push({
        orgId: org._id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        orgRole: m.role,
      });
    }

    return {
      role: profile.role,
      name: profile.name,
      orgs,
    };
  },
});

// ── Create user (action — calls auth:signIn internally) ─

export const createUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("superAdmin"),
      v.literal("orgAdmin"),
      v.literal("member"),
    ),
    orgId: v.optional(v.id("organizations")),
    orgRole: v.optional(
      v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("member"),
        v.literal("viewer"),
      ),
    ),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Lazy imports to avoid circular type inference
    const { api, internal } = await import("./_generated/api");

    // 1. Verify caller is superAdmin
    const caller = await ctx.runQuery(api.users.currentUser);
    if (!caller?.profile || caller.profile.role !== "superAdmin") {
      throw new Error("Super admin access required");
    }

    // 2. Create the auth account via signUp
    try {
      await (ctx as any).runAction(api.auth.signIn, {
        provider: "password",
        params: { email: args.email, password: args.password, flow: "signUp" },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to create account: ${msg}`);
    }

    // 3. Find the newly created user by email
    const userId: Id<"users"> | null = await ctx.runQuery(
      internal.users.findByEmail,
      { email: args.email },
    );
    if (!userId) {
      throw new Error("User was created but could not be found by email");
    }

    // 4. Create the userProfile
    await ctx.runMutation(internal.users.createProfile, {
      userId,
      name: args.name,
      role: args.role,
    });

    // 5. Optionally assign to org
    if (args.orgId) {
      await ctx.runMutation(internal.users.assignToOrg, {
        userId,
        orgId: args.orgId,
        role: args.orgRole ?? "member",
      });
    }

    return userId;
  },
});

// ── Internal helpers (not callable from client) ─────────

export const findByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Search the users table (authTables) for matching email
    const users = await ctx.db.query("users").collect();
    for (const u of users) {
      if ((u as Record<string, unknown>).email === args.email) {
        return u._id;
      }
    }
    return null;
  },
});

export const createProfile = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("superAdmin"),
      v.literal("orgAdmin"),
      v.literal("member"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        role: args.role,
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return ctx.db.insert("userProfiles", {
      userId: args.userId,
      name: args.name,
      role: args.role,
      updatedAt: Date.now(),
    });
  },
});

export const assignToOrg = internalMutation({
  args: {
    userId: v.id("users"),
    orgId: v.id("organizations"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("member"),
      v.literal("viewer"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgMembers")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      throw new Error("User is already a member of this organization");
    }
    const now = Date.now();
    return ctx.db.insert("orgMembers", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      joinedAt: now,
      updatedAt: now,
    });
  },
});
