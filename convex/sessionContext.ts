import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Single query that returns all session context needed for the studio:
 * - Authenticated user + profile
 * - Organization memberships
 * - Gateway instances for the first org
 *
 * Replaces the sequential waterfall of:
 *   currentUser → getMyOrgs → getMyGateways
 */
export const getSessionContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return { user, profile: null, orgs: [], gateways: null };
    }

    // SuperAdmin — client handles redirect to /admin
    if (profile.role === "superAdmin") {
      return { user, profile, name: profile.name, orgs: [], gateways: null };
    }

    // Org memberships
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
        orgRole: m.role,
      });
    }

    // Gateways for first org
    let gateways: {
      org: { name: string; slug: string };
      gateways: Array<{
        instanceId: string;
        name: string;
        primaryAgentName: string | null;
        gatewayUrl: string;
        token: string | null;
        status: string;
        vpsHostname: string;
        vpsIp: string;
        port: number;
        sshUser: string;
        sshPort: number;
        agentCount: number;
      }>;
    } | null = null;

    const firstOrgId = orgs[0]?.orgId;
    if (firstOrgId) {
      const org = await ctx.db.get(firstOrgId);
      const instances = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_orgId", (q) => q.eq("orgId", firstOrgId))
        .collect();

      const gwList = [];
      for (const inst of instances) {
        const vps = await ctx.db.get(inst.vpsId);
        if (!vps) continue;
        const gatewayUrl =
          inst.url ?? `ws://${vps.ipAddress || vps.hostname}:${inst.port}`;
        gwList.push({
          instanceId: inst._id as string,
          name: inst.name,
          primaryAgentName: inst.primaryAgentName ?? null,
          gatewayUrl,
          token: inst.token ?? null,
          status: inst.status,
          vpsHostname: vps.hostname,
          vpsIp: vps.ipAddress,
          port: inst.port,
          sshUser: vps.sshUser ?? "root",
          sshPort: vps.sshPort ?? 22,
          agentCount: inst.agentCount ?? 1,
        });
      }

      // Sort: running first
      gwList.sort((a, b) => {
        if (a.status === "running" && b.status !== "running") return -1;
        if (a.status !== "running" && b.status === "running") return 1;
        return 0;
      });

      gateways = {
        org: { name: org?.name ?? "", slug: org?.slug ?? "" },
        gateways: gwList,
      };
    }

    return { user, profile, name: profile.name, orgs, gateways };
  },
});
