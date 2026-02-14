import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

export const listByInstance = query({
  args: { instanceId: v.id("gatewayInstances") },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Gateway instance not found");
    await requireOrgAccess(ctx, instance.orgId);

    const assignments = await ctx.db
      .query("instanceSkills")
      .withIndex("by_instanceId", (q) => q.eq("instanceId", args.instanceId))
      .collect();

    const result = [];
    for (const a of assignments) {
      const skill = await ctx.db.get(a.skillId);
      if (skill) {
        result.push({ ...a, skill });
      }
    }
    return result;
  },
});

export const assign = mutation({
  args: {
    instanceId: v.id("gatewayInstances"),
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Gateway instance not found");
    const { orgRole, orgId } = await requireOrgAccess(ctx, instance.orgId);

    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to assign skills");
    }

    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new Error("Skill not found");
    if (!skill.isEnabled) throw new Error("Skill is not enabled");

    if (orgId) {
      const org = await ctx.db.get(orgId);
      if (org && !skill.plans.includes(org.plan)) {
        throw new Error("Skill is not available for your organization's plan");
      }
    }

    const existing = await ctx.db
      .query("instanceSkills")
      .withIndex("by_instanceId_skillId", (q) =>
        q.eq("instanceId", args.instanceId).eq("skillId", args.skillId),
      )
      .unique();
    if (existing) throw new Error("Skill is already assigned to this instance");

    return ctx.db.insert("instanceSkills", {
      instanceId: args.instanceId,
      skillId: args.skillId,
      deployedAt: Date.now(),
    });
  },
});

export const unassign = mutation({
  args: {
    instanceId: v.id("gatewayInstances"),
    skillId: v.id("skills"),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Gateway instance not found");
    const { orgRole } = await requireOrgAccess(ctx, instance.orgId);

    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to unassign skills");
    }

    const existing = await ctx.db
      .query("instanceSkills")
      .withIndex("by_instanceId_skillId", (q) =>
        q.eq("instanceId", args.instanceId).eq("skillId", args.skillId),
      )
      .unique();
    if (!existing) throw new Error("Skill is not assigned to this instance");

    await ctx.db.delete(existing._id);
  },
});
