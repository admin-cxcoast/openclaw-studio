import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib/authorization";

const MASKED = "********";

export const hasKey = query({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const first = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .first();
    return first !== null;
  },
});

export const list = query({
  args: { providerId: v.id("providers") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const creds = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId", (q) => q.eq("providerId", args.providerId))
      .collect();
    return creds.map((c) => ({
      ...c,
      value: c.sensitive ? MASKED : c.value,
    }));
  },
});

export const reveal = query({
  args: { id: v.id("providerCredentials") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const cred = await ctx.db.get(args.id);
    if (!cred) throw new Error("Credential not found");
    return cred.value;
  },
});

/** On-demand reveal callable via useMutation (no side effects, just reads). */
export const revealMut = mutation({
  args: { id: v.id("providerCredentials") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const cred = await ctx.db.get(args.id);
    if (!cred) throw new Error("Credential not found");
    return cred.value;
  },
});

export const upsert = mutation({
  args: {
    providerId: v.id("providers"),
    orgId: v.optional(v.id("organizations")),
    key: v.string(),
    value: v.string(),
    sensitive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    if (args.sensitive && args.value === MASKED) return;

    const existing = await ctx.db
      .query("providerCredentials")
      .withIndex("by_providerId_orgId", (q) =>
        q.eq("providerId", args.providerId).eq("orgId", args.orgId),
      )
      .collect();
    const match = existing.find((c) => c.key === args.key);

    if (match) {
      await ctx.db.patch(match._id, {
        value: args.value,
        sensitive: args.sensitive,
        updatedAt: Date.now(),
      });
      return match._id;
    }
    return ctx.db.insert("providerCredentials", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("providerCredentials") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
