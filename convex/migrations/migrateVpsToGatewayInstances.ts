import { internalMutation } from "../_generated/server";

/**
 * One-time migration: copies gateway config from vpsInstances (old model)
 * into the new gatewayInstances junction table.
 *
 * Run from Convex dashboard after deploying the new schema.
 * Idempotent — re-running skips already-migrated records.
 */
export const migrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allVps = await ctx.db.query("vpsInstances").collect();
    let migrated = 0;
    let skipped = 0;

    for (const vps of allVps) {
      if (!vps.orgId) {
        skipped++;
        continue;
      }

      // Skip if no gateway config at all
      if (!vps.gatewayPort && !vps.gatewayUrl) {
        skipped++;
        continue;
      }

      // Check if already migrated (idempotent)
      const existing = await ctx.db
        .query("gatewayInstances")
        .withIndex("by_vpsId_orgId", (q) =>
          q.eq("vpsId", vps._id).eq("orgId", vps.orgId!),
        )
        .first();
      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("gatewayInstances", {
        vpsId: vps._id,
        orgId: vps.orgId,
        name: `${vps.hostname}-default`,
        port: vps.gatewayPort ?? 18789,
        token: vps.gatewayToken,
        url: vps.gatewayUrl,
        status: vps.status === "running" ? "running" : "unknown",
        updatedAt: Date.now(),
      });
      migrated++;
    }

    return { migrated, skipped, total: allVps.length };
  },
});

/**
 * Step 2: Clean deprecated fields from vpsInstances after migration.
 * Run after verifying migrate() results are correct.
 */
export const cleanDeprecatedFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allVps = await ctx.db.query("vpsInstances").collect();
    let cleaned = 0;

    for (const vps of allVps) {
      if (!vps.orgId && !vps.gatewayPort && !vps.gatewayUrl && !vps.gatewayToken) {
        continue;
      }
      // Fix "unassigned" status → "running"
      const statusUpdate =
        vps.status === ("unassigned" as string) ? "running" : undefined;

      await ctx.db.patch(vps._id, {
        orgId: undefined,
        gatewayPort: undefined,
        gatewayUrl: undefined,
        gatewayToken: undefined,
        ...(statusUpdate ? { status: statusUpdate as any } : {}),
      });
      cleaned++;
    }

    return { cleaned, total: allVps.length };
  },
});
