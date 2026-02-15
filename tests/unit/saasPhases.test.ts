/**
 * SaaS Cost Model — Phase 1-5 Integration Tests
 *
 * These tests verify the structural contracts of the SaaS cost model
 * implementation across all five phases. Since Convex modules cannot
 * be imported directly in vitest (they require a live database), we
 * use filesystem reads to verify exports, schema definitions, and
 * source-level contracts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

/** Helper: read a project file as UTF-8 string. */
function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Phase 1: VPS Abstraction
// ---------------------------------------------------------------------------

describe("Phase 1: VPS Abstraction", () => {
  describe("DeployInstanceModal — no VPS selection exposed to the user", () => {
    const src = readSource(
      "src/features/agents/components/DeployInstanceModal.tsx",
    );

    it("does not contain a 'selectedVps' state variable", () => {
      expect(src).not.toMatch(/useState.*selectedVps/);
      expect(src).not.toMatch(/selectedVps/);
    });

    it("does not render a VPS selector dropdown for the user", () => {
      // The modal should NOT present a VPS picker; VPS is auto-selected.
      expect(src).not.toMatch(/select.*vps/i);
      expect(src).not.toMatch(/VPS.*select/i);
      expect(src).not.toMatch(/Choose.*VPS/i);
    });

    it("calls deployments.create without an explicit vpsId", () => {
      // The createDeployment call should NOT pass a vpsId — the backend
      // auto-places via selectBestVps.
      expect(src).toContain("createDeployment");
      // vpsId should not appear in the component at all (it is backend-only)
      expect(src).not.toMatch(/vpsId/);
    });
  });

  describe("FleetSidebar — VPS abstraction in wording", () => {
    const src = readSource(
      "src/features/agents/components/FleetSidebar.tsx",
    );

    it("mentions 'Provision a new gateway instance' (not VPS)", () => {
      expect(src).toContain("Provision a new gateway instance");
    });

    it("does not expose raw VPS terminology to the end user", () => {
      // The sidebar text should not mention "VPS" in user-facing strings.
      // (The prop names are internal, not shown to the user.)
      const userFacingStrings = src.match(/>([^<]+)</g) ?? [];
      const vpsInUi = userFacingStrings.some((s) =>
        /\bVPS\b/.test(s),
      );
      expect(vpsInUi).toBe(false);
    });
  });

  describe("selectBestVps helper in deployments.ts", () => {
    const src = readSource("convex/deployments.ts");

    it("defines selectBestVps as a local (non-exported) async function", () => {
      expect(src).toMatch(/async function selectBestVps/);
      // It should NOT be exported — it is an internal helper.
      expect(src).not.toMatch(/export.*selectBestVps/);
    });

    it("considers maxInstances and in-flight deployments for capacity", () => {
      expect(src).toContain("maxInstances");
      expect(src).toMatch(/inFlight/);
      expect(src).toContain("remaining");
    });

    it("returns null when no capacity is available", () => {
      expect(src).toMatch(/bestRemaining > 0 \? bestId : null/);
    });
  });

  describe("manage-agent API route exists", () => {
    const src = readSource("src/app/api/org/manage-agent/route.ts");

    it("exports a POST handler", () => {
      expect(src).toMatch(/export\s+async\s+function\s+POST/);
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Cost Schema + Pricing
// ---------------------------------------------------------------------------

describe("Phase 2: Cost Schema + Pricing", () => {
  describe("schema.ts — planDefinitions table", () => {
    const src = readSource("convex/schema.ts");

    it("defines the planDefinitions table", () => {
      expect(src).toContain("planDefinitions: defineTable");
    });

    it("planDefinitions has pricing fields", () => {
      expect(src).toContain("monthlyBaseCents");
      expect(src).toContain("includedInstances");
      expect(src).toContain("includedAgentsPerInstance");
      expect(src).toContain("overagePerInstanceCents");
      expect(src).toContain("overagePerAgentCents");
      expect(src).toContain("llmMarkupPercent");
    });

    it("planDefinitions is indexed by plan slug", () => {
      // Ensure the by_plan index exists on the planDefinitions table
      expect(src).toMatch(
        /planDefinitions[\s\S]*?\.index\(\s*"by_plan"/,
      );
    });
  });

  describe("schema.ts — usageSummary table", () => {
    const src = readSource("convex/schema.ts");

    it("defines the usageSummary table", () => {
      expect(src).toContain("usageSummary: defineTable");
    });

    it("usageSummary tracks cost breakdown fields", () => {
      expect(src).toContain("infrastructureCostCents");
      expect(src).toContain("llmCostCents");
      expect(src).toContain("overageCostCents");
      expect(src).toContain("totalCostCents");
    });

    it("usageSummary has orgId + period index", () => {
      expect(src).toMatch(
        /usageSummary[\s\S]*?\.index\(\s*"by_orgId_period"/,
      );
    });
  });

  describe("planDefinitions.ts — CRUD exports", () => {
    const src = readSource("convex/planDefinitions.ts");

    it("exports list query", () => {
      expect(src).toMatch(/export\s+const\s+list\s*=/);
    });

    it("exports getByPlan query", () => {
      expect(src).toMatch(/export\s+const\s+getByPlan\s*=/);
    });

    it("exports upsert mutation", () => {
      expect(src).toMatch(/export\s+const\s+upsert\s*=/);
    });

    it("exports remove mutation", () => {
      expect(src).toMatch(/export\s+const\s+remove\s*=/);
    });

    it("upsert creates if not found, patches if existing", () => {
      expect(src).toContain("ctx.db.patch(existing._id");
      expect(src).toContain('ctx.db.insert("planDefinitions"');
    });
  });

  describe("billing.ts — query exports", () => {
    const src = readSource("convex/billing.ts");

    it("exports getOrgCurrentUsage query", () => {
      expect(src).toMatch(/export\s+const\s+getOrgCurrentUsage\s*=/);
    });

    it("exports getOrgUsageHistory query", () => {
      expect(src).toMatch(/export\s+const\s+getOrgUsageHistory\s*=/);
    });

    it("exports getGlobalCostSummary query", () => {
      expect(src).toMatch(/export\s+const\s+getGlobalCostSummary\s*=/);
    });

    it("getOrgCurrentUsage computes infrastructure cost share", () => {
      expect(src).toContain("infrastructureCostCents");
      // Verify proportional split logic
      expect(src).toMatch(/orgOnVps\s*\/\s*totalOnVps/);
    });

    it("getOrgCurrentUsage computes overage costs", () => {
      expect(src).toContain("overageCostCents");
      expect(src).toContain("overagePerInstanceCents");
      expect(src).toContain("overagePerAgentCents");
    });

    it("getGlobalCostSummary returns margin (revenue - VPS)", () => {
      expect(src).toMatch(
        /marginCents:\s*totalOrgCostCents\s*-\s*totalVpsCostCents/,
      );
    });

    it("exports _snapshotMonthlyUsage internal mutation", () => {
      expect(src).toMatch(
        /export\s+const\s+_snapshotMonthlyUsage\s*=\s*internalMutation/,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Subagent Support
// ---------------------------------------------------------------------------

describe("Phase 3: Subagent Support", () => {
  describe("agents.ts — Convex mutation/query exports", () => {
    const src = readSource("convex/agents.ts");

    it("exports requestCreate mutation", () => {
      expect(src).toMatch(/export\s+const\s+requestCreate\s*=/);
    });

    it("exports confirmCreate mutation", () => {
      expect(src).toMatch(/export\s+const\s+confirmCreate\s*=/);
    });

    it("exports confirmRemove mutation", () => {
      expect(src).toMatch(/export\s+const\s+confirmRemove\s*=/);
    });

    it("exports getInstanceAgentCount query", () => {
      expect(src).toMatch(/export\s+const\s+getInstanceAgentCount\s*=/);
    });

    it("requestCreate checks org-level maxAgents quota", () => {
      expect(src).toContain("maxAgents");
      expect(src).toContain("Agent limit reached");
    });

    it("confirmCreate increments agentCount", () => {
      expect(src).toMatch(/agentCount:\s*currentCount\s*\+\s*1/);
    });

    it("confirmRemove decrements agentCount (clamped to 0)", () => {
      expect(src).toMatch(
        /agentCount:\s*Math\.max\(\s*0\s*,\s*currentCount\s*-\s*1\s*\)/,
      );
    });

    it("requestCreate blocks viewer role", () => {
      expect(src).toContain("Viewer role cannot create agents");
    });
  });

  describe("manage-agent API route", () => {
    const src = readSource("src/app/api/org/manage-agent/route.ts");

    it("exports a POST handler", () => {
      expect(src).toMatch(/export\s+async\s+function\s+POST/);
    });

    it("validates required params (instanceId, action, agentName)", () => {
      expect(src).toContain("instanceId");
      expect(src).toContain("action");
      expect(src).toContain("agentName");
      expect(src).toContain(
        "instanceId, action, and agentName are required",
      );
    });

    it("returns 400 when params are missing", () => {
      expect(src).toContain("status: 400");
    });

    it("returns 401 for unauthorized requests (missing x-studio-request)", () => {
      expect(src).toContain("x-studio-request");
      expect(src).toContain("status: 401");
    });

    it('only accepts "create" and "remove" actions', () => {
      expect(src).toMatch(/\["create",\s*"remove"\]/);
      expect(src).toContain("Invalid action");
    });

    it("proxies to gateway RPC for agent create", () => {
      expect(src).toContain("/rpc/agents.create");
    });

    it("proxies to gateway RPC for agent remove", () => {
      expect(src).toContain("/rpc/agents.remove");
    });

    it("updates agentCount in Convex after successful gateway RPC", () => {
      expect(src).toContain("updateFromSystem");
      expect(src).toContain("agentCount");
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 4: LLM Usage Metering
// ---------------------------------------------------------------------------

describe("Phase 4: LLM Usage Metering", () => {
  describe("schema.ts — usageRecords table", () => {
    const src = readSource("convex/schema.ts");

    it("defines the usageRecords table", () => {
      expect(src).toContain("usageRecords: defineTable");
    });

    it("usageRecords has token count fields", () => {
      // Find the usageRecords block and check it contains token fields
      const usageBlock = src.slice(
        src.indexOf("usageRecords: defineTable"),
      );
      expect(usageBlock).toContain("inputTokens");
      expect(usageBlock).toContain("outputTokens");
    });

    it("usageRecords has costCents field", () => {
      const usageBlock = src.slice(
        src.indexOf("usageRecords: defineTable"),
      );
      expect(usageBlock).toContain("costCents");
    });

    it("usageRecords tracks orgId, instanceId, agentId, modelId", () => {
      const usageBlock = src.slice(
        src.indexOf("usageRecords: defineTable"),
      );
      expect(usageBlock).toContain("orgId");
      expect(usageBlock).toContain("instanceId");
      expect(usageBlock).toContain("agentId");
      expect(usageBlock).toContain("modelId");
    });

    it("usageRecords is indexed by orgId+period and by instanceId", () => {
      expect(src).toMatch(
        /usageRecords[\s\S]*?\.index\(\s*"by_orgId_period"/,
      );
      expect(src).toMatch(
        /usageRecords[\s\S]*?\.index\(\s*"by_instanceId"/,
      );
    });
  });

  describe("usageRecords.ts — exports", () => {
    const src = readSource("convex/usageRecords.ts");

    it("exports recordFromGateway mutation", () => {
      expect(src).toMatch(/export\s+const\s+recordFromGateway\s*=/);
    });

    it("exports getByOrgPeriod query", () => {
      expect(src).toMatch(/export\s+const\s+getByOrgPeriod\s*=/);
    });

    it("exports getAggregatedByModel query", () => {
      expect(src).toMatch(/export\s+const\s+getAggregatedByModel\s*=/);
    });

    it("exports getByInstance query", () => {
      expect(src).toMatch(/export\s+const\s+getByInstance\s*=/);
    });
  });

  describe("usageRecords.ts — cost calculation logic", () => {
    const src = readSource("convex/usageRecords.ts");

    it("computes costCents using (tokens/1000 * rate) * 100", () => {
      // The formula: (inputTokens / 1000) * costPer1kIn + (outputTokens / 1000) * costPer1kOut) * 100
      expect(src).toContain("args.inputTokens / 1000");
      expect(src).toContain("args.outputTokens / 1000");
      expect(src).toMatch(/\*\s*100/);
    });

    it("rounds the cost to whole cents via Math.round", () => {
      expect(src).toMatch(/Math\.round\(/);
      // Specifically within the cost calculation
      expect(src).toMatch(
        /const costCents\s*=\s*Math\.round\(/,
      );
    });

    it("looks up model pricing from the models table (not hardcoded)", () => {
      // Cost per 1k should come from the DB, not from a constant
      expect(src).toContain("costPer1kInput");
      expect(src).toContain("costPer1kOutput");
      expect(src).toContain('.query("models")');
    });

    it("defaults to 0 cost when model has no pricing", () => {
      expect(src).toMatch(/costPer1kIn.*\?\?.*0/);
      expect(src).toMatch(/costPer1kOut.*\?\?.*0/);
    });

    it("validates provisioner secret before accepting reports", () => {
      expect(src).toContain("provisioner_secret");
      expect(src).toContain("Invalid provisioner secret");
    });

    it("updates usageSummary.llmCostCents when recording", () => {
      expect(src).toContain("llmCostCents");
      expect(src).toContain('query("usageSummary")');
    });
  });

  describe("Cost calculation — pure math verification", () => {
    // Test the formula from usageRecords.ts manually:
    // costCents = Math.round(
    //   ((inputTokens / 1000) * costPer1kIn +
    //    (outputTokens / 1000) * costPer1kOut) * 100
    // )

    function computeCostCents(
      inputTokens: number,
      outputTokens: number,
      costPer1kInput: number,
      costPer1kOutput: number,
    ): number {
      return Math.round(
        ((inputTokens / 1000) * costPer1kInput +
          (outputTokens / 1000) * costPer1kOutput) *
          100,
      );
    }

    it("calculates 0 cents for zero tokens", () => {
      expect(computeCostCents(0, 0, 0.003, 0.015)).toBe(0);
    });

    it("calculates cost for a typical Claude Sonnet request", () => {
      // 1000 input tokens at $0.003/1k, 500 output tokens at $0.015/1k
      // ($0.003 + $0.0075) * 100 = 1.05 cents -> 1 cent
      const result = computeCostCents(1000, 500, 0.003, 0.015);
      expect(result).toBe(1);
    });

    it("calculates cost for a large request", () => {
      // 50,000 input at $0.003/1k = $0.15
      // 10,000 output at $0.015/1k = $0.15
      // Total = $0.30 = 30 cents
      const result = computeCostCents(50000, 10000, 0.003, 0.015);
      expect(result).toBe(30);
    });

    it("handles expensive models correctly", () => {
      // 100,000 input at $0.015/1k = $1.50
      // 50,000 output at $0.075/1k = $3.75
      // Total = $5.25 = 525 cents
      const result = computeCostCents(100000, 50000, 0.015, 0.075);
      expect(result).toBe(525);
    });

    it("returns 0 when model has no pricing (rates are 0)", () => {
      const result = computeCostCents(10000, 5000, 0, 0);
      expect(result).toBe(0);
    });

    it("correctly rounds fractional cents", () => {
      // 1500 input at $0.003/1k = $0.0045
      // 750 output at $0.015/1k = $0.01125
      // Total = $0.01575 * 100 = 1.575 cents -> rounds to 2
      const result = computeCostCents(1500, 750, 0.003, 0.015);
      expect(result).toBe(2);
    });
  });

  describe("modelCatalog.ts — no hardcoded cost fields", () => {
    const src = readSource("convex/lib/modelCatalog.ts");

    it("ModelMeta type does not include cost fields", () => {
      // The ModelMeta type should NOT have costPer1kInput or costPer1kOutput.
      // Pricing lives in the models DB table, managed by super admin.
      const typeBlock = src.slice(
        src.indexOf("export type ModelMeta"),
        src.indexOf("};", src.indexOf("export type ModelMeta")) + 2,
      );
      expect(typeBlock).not.toContain("costPer1kInput");
      expect(typeBlock).not.toContain("costPer1kOutput");
      expect(typeBlock).not.toContain("cost");
      expect(typeBlock).not.toContain("price");
    });

    it("ModelMeta includes only metadata fields (name, contextWindow, capabilities)", () => {
      const typeBlock = src.slice(
        src.indexOf("export type ModelMeta"),
        src.indexOf("};", src.indexOf("export type ModelMeta")) + 2,
      );
      expect(typeBlock).toContain("name");
      expect(typeBlock).toContain("contextWindow");
      expect(typeBlock).toContain("capabilities");
    });

    it("catalog entries do not contain dollar amounts or price values", () => {
      // The META record should have no numeric cost values
      const metaBlock = src.slice(
        src.indexOf("const META:"),
        src.lastIndexOf("};") + 2,
      );
      expect(metaBlock).not.toContain("costPer1k");
      expect(metaBlock).not.toContain("price");
    });
  });

  describe("usage-report API route", () => {
    const src = readSource(
      "src/app/api/gateway/usage-report/route.ts",
    );

    it("exists and exports a POST handler", () => {
      expect(src).toMatch(/export\s+async\s+function\s+POST/);
    });

    it("requires Authorization Bearer token", () => {
      expect(src).toContain("Bearer");
      expect(src).toContain("Authorization required");
    });

    it("requires instanceId in the request body", () => {
      expect(src).toContain("instanceId is required");
    });

    it("supports batch records via records array", () => {
      expect(src).toContain("body.records");
    });

    it("calls usageRecords.recordFromGateway for each record", () => {
      expect(src).toContain("usageRecords.recordFromGateway");
    });

    it("derives default period from current date", () => {
      expect(src).toMatch(/defaultPeriod/);
      expect(src).toContain("getFullYear");
      expect(src).toContain("getMonth");
    });

    it("validates each record has required fields", () => {
      expect(src).toContain("agentId");
      expect(src).toContain("modelId");
      expect(src).toContain("inputTokens");
      expect(src).toContain("outputTokens");
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Billing Dashboards
// ---------------------------------------------------------------------------

describe("Phase 5: Billing Dashboards", () => {
  describe("Admin billing page", () => {
    const src = readSource("src/app/admin/billing/page.tsx");

    it("exists and exports a default component", () => {
      expect(src).toMatch(/export\s+default\s+function\s+BillingPage/);
    });

    it("uses billing.getGlobalCostSummary query", () => {
      expect(src).toContain("billing.getGlobalCostSummary");
    });

    it("renders KPI cards for VPS Spend, Org Revenue, LLM Costs, Margin", () => {
      expect(src).toContain("VPS Spend");
      expect(src).toContain("Org Revenue");
      expect(src).toContain("LLM Costs");
      expect(src).toContain("Margin");
    });

    it("renders a per-org breakdown table", () => {
      expect(src).toContain("Organization");
      expect(src).toContain("perOrg");
    });

    it("formats cents as dollars with formatCents helper", () => {
      expect(src).toMatch(/formatCents/);
      expect(src).toMatch(/cents\s*\/\s*100/);
    });
  });

  describe("OrgBillingPanel component", () => {
    const src = readSource(
      "src/features/billing/components/OrgBillingPanel.tsx",
    );

    it("exists and exports OrgBillingPanel", () => {
      expect(src).toMatch(
        /export\s+function\s+OrgBillingPanel/,
      );
    });

    it("uses billing.getOrgCurrentUsage query", () => {
      expect(src).toContain("billing.getOrgCurrentUsage");
    });

    it("uses billing.getOrgUsageHistory query", () => {
      expect(src).toContain("billing.getOrgUsageHistory");
    });

    it("uses usageRecords.getAggregatedByModel query", () => {
      expect(src).toContain("usageRecords.getAggregatedByModel");
    });

    it("renders cost breakdown section", () => {
      expect(src).toContain("Cost Breakdown");
      expect(src).toContain("Plan base");
      expect(src).toContain("Infrastructure share");
      expect(src).toContain("LLM usage");
    });

    it("renders LLM usage by model section", () => {
      expect(src).toContain("LLM Usage by Model");
    });

    it("renders monthly history section", () => {
      expect(src).toContain("Monthly History");
    });

    it("shows overage cost when present", () => {
      expect(src).toContain("Overage");
      expect(src).toContain("overageCostCents");
    });

    it("accepts orgId as a prop", () => {
      expect(src).toContain("orgId: string");
    });
  });

  describe("AdminSidebar — billing navigation", () => {
    const src = readSource(
      "src/features/admin/components/AdminSidebar.tsx",
    );

    it("includes a Billing nav item", () => {
      expect(src).toMatch(/label:\s*"Billing"/);
    });

    it("Billing nav links to /admin/billing", () => {
      expect(src).toMatch(/href:\s*"\/admin\/billing"/);
    });

    it("uses the Receipt icon for Billing", () => {
      expect(src).toContain("Receipt");
      expect(src).toMatch(
        /{\s*href:\s*"\/admin\/billing"\s*,\s*label:\s*"Billing"\s*,\s*icon:\s*Receipt\s*}/,
      );
    });

    it("also includes a Plans nav item (plan management)", () => {
      expect(src).toMatch(/label:\s*"Plans"/);
      expect(src).toMatch(/href:\s*"\/admin\/plans"/);
    });
  });

  describe("models table schema has cost fields (admin-managed pricing)", () => {
    const src = readSource("convex/schema.ts");

    it("models table includes costPer1kInput and costPer1kOutput", () => {
      // These fields live in the DB models table, NOT in modelCatalog.ts.
      // This is the key design decision: pricing is admin-managed.
      const modelsBlock = src.slice(
        src.indexOf("models: defineTable"),
        src.indexOf(
          ".index",
          src.indexOf("models: defineTable"),
        ),
      );
      expect(modelsBlock).toContain("costPer1kInput");
      expect(modelsBlock).toContain("costPer1kOutput");
    });
  });
});
