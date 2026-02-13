import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Authentication required");
  return userId;
}

export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await requireAuth(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile || profile.role !== "superAdmin") {
    throw new Error("Super admin access required");
  }
  return { userId, profile };
}

/**
 * Require the caller to be a member of an organization.
 * SuperAdmins are allowed access to any org (pass orgId to scope).
 * Normal users must have an orgMembers record.
 *
 * If no orgId is provided, returns the user's first org membership.
 */
export async function requireOrgAccess(
  ctx: QueryCtx | MutationCtx,
  orgId?: Id<"organizations">,
) {
  const userId = await requireAuth(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) throw new Error("User profile not found");

  // SuperAdmins can access any org
  if (profile.role === "superAdmin") {
    return { userId, profile, orgId: orgId ?? null, orgRole: "owner" as const };
  }

  // Find memberships
  const memberships = await ctx.db
    .query("orgMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  if (memberships.length === 0) {
    throw new Error("No organization membership found");
  }

  if (orgId) {
    const match = memberships.find((m) => m.orgId === orgId);
    if (!match) throw new Error("Not a member of this organization");
    return { userId, profile, orgId, orgRole: match.role };
  }

  // Default to first membership
  const first = memberships[0];
  return { userId, profile, orgId: first.orgId, orgRole: first.role };
}
