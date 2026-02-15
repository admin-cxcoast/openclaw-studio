import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

const MASKED = "********";

export const list = query({
  args: {
    skillId: v.id("skills"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { orgRole } = await requireOrgAccess(ctx, args.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required");
    }
    const values = await ctx.db
      .query("skillEnvValues")
      .withIndex("by_skillId_orgId", (q) =>
        q.eq("skillId", args.skillId).eq("orgId", args.orgId),
      )
      .collect();
    return values.map((v) => ({ ...v, value: MASKED }));
  },
});

export const revealMut = mutation({
  args: { id: v.id("skillEnvValues") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Env value not found");
    const { orgRole } = await requireOrgAccess(ctx, doc.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required");
    }
    return doc.value;
  },
});

export const upsert = mutation({
  args: {
    skillId: v.id("skills"),
    orgId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgRole } = await requireOrgAccess(ctx, args.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required");
    }
    if (args.value === MASKED) return;

    const existing = await ctx.db
      .query("skillEnvValues")
      .withIndex("by_skillId_orgId", (q) =>
        q.eq("skillId", args.skillId).eq("orgId", args.orgId),
      )
      .collect();
    const match = existing.find((e) => e.key === args.key);

    if (match) {
      await ctx.db.patch(match._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return match._id;
    }
    return ctx.db.insert("skillEnvValues", {
      skillId: args.skillId,
      orgId: args.orgId,
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("skillEnvValues") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Env value not found");
    const { orgRole } = await requireOrgAccess(ctx, doc.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required");
    }
    await ctx.db.delete(args.id);
  },
});

export const listConfigured = query({
  args: {
    skillId: v.id("skills"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requireOrgAccess(ctx, args.orgId);
    const values = await ctx.db
      .query("skillEnvValues")
      .withIndex("by_skillId_orgId", (q) =>
        q.eq("skillId", args.skillId).eq("orgId", args.orgId),
      )
      .collect();
    return values.map((v) => v.key);
  },
});
