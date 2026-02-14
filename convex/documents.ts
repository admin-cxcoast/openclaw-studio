import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOrgAccess } from "./lib/authorization";

export const list = query({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();

    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listByType = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    docType: v.union(
      v.literal("general"),
      v.literal("spec"),
      v.literal("runbook"),
      v.literal("reference"),
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_orgId_docType", (q) =>
        q.eq("orgId", orgId).eq("docType", args.docType),
      )
      .collect();

    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listByInstance = query({
  args: { instanceId: v.id("gatewayInstances") },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId);
    if (!instance) throw new Error("Gateway instance not found");
    await requireOrgAccess(ctx, instance.orgId);

    return ctx.db
      .query("documents")
      .withIndex("by_instanceId", (q) => q.eq("instanceId", args.instanceId))
      .collect();
  },
});

export const search = query({
  args: {
    orgId: v.optional(v.id("organizations")),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (!orgId) return [];

    return ctx.db
      .query("documents")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query).eq("orgId", orgId),
      )
      .collect();
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    await requireOrgAccess(ctx, doc.orgId);
    return doc;
  },
});

export const create = mutation({
  args: {
    orgId: v.optional(v.id("organizations")),
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
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, orgId, orgRole } = await requireOrgAccess(
      ctx,
      args.orgId ?? undefined,
    );
    if (!orgId) throw new Error("Organization required");
    if (orgRole === "viewer") throw new Error("Viewer cannot create documents");

    return ctx.db.insert("documents", {
      orgId,
      title: args.title,
      content: args.content,
      docType: args.docType,
      instanceId: args.instanceId,
      tags: args.tags,
      createdBy: userId,
      updatedAt: Date.now(),
      ...(args.storageId && { storageId: args.storageId }),
      ...(args.fileName && { fileName: args.fileName }),
      ...(args.fileSize !== undefined && { fileSize: args.fileSize }),
      ...(args.mimeType && { mimeType: args.mimeType }),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    docType: v.optional(
      v.union(
        v.literal("general"),
        v.literal("spec"),
        v.literal("runbook"),
        v.literal("reference"),
      ),
    ),
    instanceId: v.optional(v.id("gatewayInstances")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    const { orgRole } = await requireOrgAccess(ctx, doc.orgId);
    if (orgRole === "viewer") throw new Error("Viewer cannot edit documents");

    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) updates[k] = val;
    }
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    const { orgRole } = await requireOrgAccess(ctx, doc.orgId);
    if (orgRole !== "owner" && orgRole !== "admin") {
      throw new Error("Admin access required to delete documents");
    }

    if (doc.storageId) {
      await ctx.storage.delete(doc.storageId);
    }

    await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: { orgId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const { orgRole } = await requireOrgAccess(ctx, args.orgId ?? undefined);
    if (orgRole === "viewer") throw new Error("Viewer cannot upload files");
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
