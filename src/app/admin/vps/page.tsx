"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import {
  RefreshCw,
  Plus,
  Trash2,
  Tag,
  X,
  Settings2,
  ChevronDown,
  ChevronRight,
  Server,
  Zap,
  Radar,
  Download,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Copy,
} from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

const DEFAULT_GATEWAY_PORT = 18789;

// ── Capacity Bar ─────────────────────────────────────────
function CapacityBar({
  used,
  max,
  plan,
}: {
  used: number;
  max: number;
  plan?: string | null;
}) {
  const pct = max > 0 ? (used / max) * 100 : 0;
  const isFull = used >= max;
  return (
    <div className="flex items-center gap-2">
      {plan && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {plan}
        </span>
      )}
      <div className="flex h-2 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${isFull ? "bg-destructive" : "bg-green-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={`font-mono text-[10px] ${isFull ? "text-destructive" : "text-muted-foreground"}`}
      >
        {used}/{max}
      </span>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-green-500/10 text-green-600 dark:text-green-400",
    provisioning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    stopped: "bg-muted text-muted-foreground",
    error: "bg-destructive/10 text-destructive",
    unknown: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] capitalize ${colors[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

// ── Add Instance Form ────────────────────────────────────
function AddInstanceForm({
  vpsId,
  vpsHostname,
  vpsIp,
  existingPorts,
  orgs,
  onClose,
}: {
  vpsId: Id<"vpsInstances">;
  vpsHostname: string;
  vpsIp: string;
  existingPorts: number[];
  orgs: Array<{ _id: Id<"organizations">; name: string }>;
  onClose: () => void;
}) {
  const createInstance = useMutation(api.gatewayInstances.create);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState<Id<"organizations"> | "">("");
  const [port, setPort] = useState<number | "">(
    nextAvailablePort(existingPorts),
  );
  const [token, setToken] = useState("");
  const [urlOverride, setUrlOverride] = useState("");
  const [stateDir, setStateDir] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !name.trim() || port === "") return;
    setSaving(true);
    setError("");
    try {
      await createInstance({
        vpsId,
        orgId: orgId as Id<"organizations">,
        name: name.trim(),
        port: Number(port),
        token: token || undefined,
        url: urlOverride || undefined,
        stateDir: stateDir || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create instance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-border/50 px-4 py-4 bg-muted/10">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Add Gateway Instance on {vpsHostname}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Instance Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="myorg-prod-1"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Organization
          </label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value as Id<"organizations">)}
            required
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select org...</option>
            {orgs.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Port
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) =>
              setPort(e.target.value ? Number(e.target.value) : "")
            }
            required
            placeholder={String(DEFAULT_GATEWAY_PORT)}
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Gateway Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="From ~/.openclaw/openclaw.json"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            URL Override (optional)
          </label>
          <input
            value={urlOverride}
            onChange={(e) => setUrlOverride(e.target.value)}
            placeholder={`ws://${vpsIp}:${port || DEFAULT_GATEWAY_PORT}`}
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="font-mono text-[9px] text-muted-foreground">
            Leave blank to auto-build from IP + port
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          State Directory (optional)
        </label>
        <input
          value={stateDir}
          onChange={(e) => setStateDir(e.target.value)}
          placeholder="/opt/openclaw/instances/myorg-prod-1"
          className="max-w-md rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving || !orgId || !name.trim()}
          className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Instance"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Edit Instance Inline ─────────────────────────────────
function EditInstanceRow({
  inst,
  vpsIp,
  orgs,
  onClose,
}: {
  inst: {
    _id: Id<"gatewayInstances">;
    name: string;
    port: number;
    token?: string;
    url?: string;
    stateDir?: string;
    orgId: Id<"organizations">;
    orgName: string | null;
  };
  vpsIp: string;
  orgs: Array<{ _id: Id<"organizations">; name: string }>;
  onClose: () => void;
}) {
  const updateInstance = useMutation(api.gatewayInstances.update);
  const [name, setName] = useState(inst.name);
  const [port, setPort] = useState<number | "">(inst.port);
  const [token, setToken] = useState("");
  const [url, setUrl] = useState(inst.url ?? "");
  const [stateDir, setStateDir] = useState(inst.stateDir ?? "");
  const [orgId, setOrgId] = useState<Id<"organizations">>(inst.orgId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateInstance({
        id: inst._id,
        name: name.trim() || undefined,
        port: port !== "" ? Number(port) : undefined,
        token: token || undefined,
        url: url || undefined,
        stateDir: stateDir || undefined,
        orgId: orgId !== inst.orgId ? orgId : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-border/30 bg-muted/10">
      <td colSpan={7} className="px-8 py-3">
        <div className="max-w-2xl space-y-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Edit Instance — {inst.name}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Organization
              </label>
              <select
                value={orgId}
                onChange={(e) =>
                  setOrgId(e.target.value as Id<"organizations">)
                }
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {orgs.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) =>
                  setPort(e.target.value ? Number(e.target.value) : "")
                }
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={inst.token ? "********  (blank = keep)" : "Paste gateway token"}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                URL Override
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`ws://${vpsIp}:${port || DEFAULT_GATEWAY_PORT}`}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Scan types ───────────────────────────────────────────
type ScanResult = {
  port: number;
  token?: string | null;
  stateDir?: string | null;
  agentCount?: number;
  source?: string;
  containerId?: string;
  containerName?: string;
  image?: string;
};

// ── Scan Results Panel ───────────────────────────────────
function ScanResultsPanel({
  vpsId,
  vpsHostname,
  vpsIp,
  results,
  existingInstances,
  orgs,
  onClose,
}: {
  vpsId: Id<"vpsInstances">;
  vpsHostname: string;
  vpsIp: string;
  results: ScanResult[];
  existingInstances: Array<{ _id: Id<"gatewayInstances">; port: number }>;
  orgs: Array<{ _id: Id<"organizations">; name: string }>;
  onClose: () => void;
}) {
  const createInstance = useMutation(api.gatewayInstances.create);
  const updateInstance = useMutation(api.gatewayInstances.update);
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [updated, setUpdated] = useState<Set<number>>(new Set());
  // Auto-select first org if only one exists
  const [selectedOrg, setSelectedOrg] = useState<Id<"organizations"> | "">(
    orgs.length === 1 ? orgs[0]._id : "",
  );
  const [error, setError] = useState("");

  const existingPorts = existingInstances.map((i) => i.port);
  const portToId = new Map(existingInstances.map((i) => [i.port, i._id]));

  const handleImport = async (result: ScanResult) => {
    if (!selectedOrg) {
      setError("Select an organization first");
      return;
    }
    setImporting((prev) => new Set(prev).add(result.port));
    setError("");
    try {
      await createInstance({
        vpsId,
        orgId: selectedOrg as Id<"organizations">,
        name: `${vpsHostname}-${result.port}`,
        port: result.port,
        token: result.token ?? undefined,
        stateDir: result.stateDir ?? undefined,
        status: "running",
        agentCount: result.agentCount ?? undefined,
      });
      setImported((prev) => new Set(prev).add(result.port));
    } catch (err: any) {
      setError(err?.message ?? "Import failed");
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(result.port);
        return next;
      });
    }
  };

  const handleUpdate = async (result: ScanResult) => {
    const instId = portToId.get(result.port);
    if (!instId) return;
    setImporting((prev) => new Set(prev).add(result.port));
    setError("");
    try {
      await updateInstance({
        id: instId,
        status: "running",
        agentCount: result.agentCount ?? 0,
        token: result.token ?? undefined,
        stateDir: result.stateDir ?? undefined,
      });
      setUpdated((prev) => new Set(prev).add(result.port));
    } catch (err: any) {
      setError(err?.message ?? "Update failed");
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(result.port);
        return next;
      });
    }
  };

  const handleImportAll = async () => {
    if (!selectedOrg) {
      setError("Select an organization first");
      return;
    }
    for (const result of results) {
      if (existingPorts.includes(result.port) || imported.has(result.port))
        continue;
      await handleImport(result);
    }
  };

  const handleUpdateAll = async () => {
    for (const result of results) {
      if (!existingPorts.includes(result.port) || updated.has(result.port))
        continue;
      await handleUpdate(result);
    }
  };

  const newResults = results.filter(
    (r) => !existingPorts.includes(r.port) && !imported.has(r.port),
  );
  const staleResults = results.filter(
    (r) => existingPorts.includes(r.port) && !updated.has(r.port),
  );

  return (
    <div className="space-y-3 border-t border-border/50 bg-primary/[0.02] px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Radar size={12} className="mr-1 inline" />
          Scan Results — {results.length} instance{results.length !== 1 ? "s" : ""} found on {vpsHostname}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Org selector for import */}
      <div className="flex items-center gap-3">
        <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Import to Org:
        </label>
        <select
          value={selectedOrg}
          onChange={(e) =>
            setSelectedOrg(e.target.value as Id<"organizations">)
          }
          className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Select org...</option>
          {orgs.map((o) => (
            <option key={o._id} value={o._id}>
              {o.name}
            </option>
          ))}
        </select>
        {newResults.length > 0 && (
          <button
            onClick={handleImportAll}
            disabled={!selectedOrg}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download size={12} /> Import All ({newResults.length})
          </button>
        )}
        {staleResults.length > 0 && (
          <button
            onClick={handleUpdateAll}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground hover:bg-muted"
          >
            <RefreshCw size={12} /> Update All ({staleResults.length})
          </button>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border/30 text-left">
            {["Port", "Token", "Agents", "Container / State Dir", "Source", ""].map(
              (h) => (
                <th
                  key={h}
                  className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const alreadyExists = existingPorts.includes(r.port);
            const wasImported = imported.has(r.port);
            const isImporting = importing.has(r.port);
            return (
              <tr
                key={r.port}
                className="border-b border-border/30 last:border-0"
              >
                <td className="px-3 py-2 font-mono text-xs text-foreground">
                  :{r.port}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.token ? "present" : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.agentCount ?? 0}
                </td>
                <td className="max-w-[250px] truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {r.containerName ? (
                    <span title={r.image}>
                      <span className="text-primary/70">🐳</span> {r.containerName}
                      {r.containerId && <span className="ml-1 text-muted-foreground/50">({r.containerId})</span>}
                    </span>
                  ) : (
                    r.stateDir ?? "—"
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {r.source ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {alreadyExists ? (
                    updated.has(r.port) ? (
                      <span className="font-mono text-[10px] text-green-600 dark:text-green-400">
                        Updated
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUpdate(r)}
                        disabled={isImporting}
                        className="rounded-md border border-border px-2 py-1 font-mono text-[10px] text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {isImporting ? "..." : "Update"}
                      </button>
                    )
                  ) : wasImported ? (
                    <span className="font-mono text-[10px] text-green-600 dark:text-green-400">
                      Imported
                    </span>
                  ) : (
                    <button
                      onClick={() => handleImport(r)}
                      disabled={isImporting || !selectedOrg}
                      className="rounded-md border border-border px-2 py-1 font-mono text-[10px] text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {isImporting ? "..." : "Import"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Helper: next available port ──────────────────────────
function nextAvailablePort(existing: number[]): number {
  let port = DEFAULT_GATEWAY_PORT;
  while (existing.includes(port)) port++;
  return port;
}

// ── VPS Settings Edit Panel ───────────────────────────────
function VpsSettingsPanel({
  vps,
  onSave,
  onClose,
}: {
  vps: {
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
    maxInstances?: number;
  };
  onSave: (updates: {
    ipAddress?: string;
    sshUser?: string;
    sshPort?: number;
    maxInstances?: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [ip, setIp] = useState(vps.ipAddress ?? "");
  const [sshUser, setSshUser] = useState(vps.sshUser ?? "");
  const [sshPort, setSshPort] = useState<number | "">(vps.sshPort ?? "");
  const [maxInst, setMaxInst] = useState<number | "">(vps.maxInstances ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ipAddress: ip.trim() || undefined,
        sshUser: sshUser.trim() || undefined,
        sshPort: sshPort !== "" ? Number(sshPort) : undefined,
        maxInstances: maxInst !== "" ? Number(maxInst) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="border-t border-border/50 bg-muted/20 px-4 py-4"
    >
      <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        VPS Settings
      </div>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            IP Address
          </label>
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="185.x.x.x"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            SSH User
          </label>
          <input
            value={sshUser}
            onChange={(e) => setSshUser(e.target.value)}
            placeholder="root"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="font-mono text-[9px] text-muted-foreground">
            Used for scan. Default: root
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            SSH Port
          </label>
          <input
            type="number"
            value={sshPort}
            onChange={(e) =>
              setSshPort(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="22"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Max Instances
          </label>
          <input
            type="number"
            min={1}
            value={maxInst}
            onChange={(e) =>
              setMaxInst(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="1"
            className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── SSH Key Setup Types ──────────────────────────────────
type SshSetupStep = "idle" | "checking" | "generating" | "registering" | "attaching" | "done" | "error";

type AttachDetail = { hostname: string; hostingerId: string; status: number; body: string };

type SshKeyState = {
  exists: boolean | null;
  publicKey: string | null;
  keyPath: string | null;
  hostingerKeyId: number | null;
  step: SshSetupStep;
  error: string | null;
  attachResult: { attached: number; failed: number; details: AttachDetail[] } | null;
};

// ── SSH Key Setup Banner ─────────────────────────────────
function SshKeySetupBanner({
  onSetupComplete,
}: {
  onSetupComplete: () => void;
}) {
  const registerSshKey = useAction(api.hostinger.registerSshKey);
  const attachSshKey = useAction(api.hostinger.attachSshKeyToAllVps);

  const [state, setState] = useState<SshKeyState>({
    exists: null,
    publicKey: null,
    keyPath: null,
    hostingerKeyId: null,
    step: "checking",
    error: null,
    attachResult: null,
  });

  const checkKey = useCallback(async () => {
    setState((s) => ({ ...s, step: "checking", error: null }));
    try {
      const res = await fetch("/api/admin/ssh-keys/setup");
      const data = await res.json();
      if (data.error) {
        setState((s) => ({ ...s, step: "error", error: data.error }));
        return;
      }
      setState((s) => ({
        ...s,
        exists: data.exists,
        publicKey: data.publicKey,
        keyPath: data.keyPath,
        step: data.exists ? "done" : "idle",
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, step: "error", error: err?.message ?? "Failed to check SSH key" }));
    }
  }, []);

  useEffect(() => {
    checkKey();
  }, [checkKey]);

  const runFullSetup = async () => {
    setState((s) => ({ ...s, step: "generating", error: null }));
    try {
      // Step 1: Generate key
      const genRes = await fetch("/api/admin/ssh-keys/setup", { method: "POST" });
      const genData = await genRes.json();
      if (genData.error) {
        setState((s) => ({ ...s, step: "error", error: genData.error }));
        return;
      }
      const publicKey = genData.publicKey as string;
      setState((s) => ({ ...s, publicKey, exists: true }));

      // Step 2: Register with Hostinger
      setState((s) => ({ ...s, step: "registering" }));
      const regResult = await registerSshKey({ publicKey });
      const keyId = regResult.id;
      setState((s) => ({ ...s, hostingerKeyId: keyId }));

      // Step 3: Attach to all VPS
      setState((s) => ({ ...s, step: "attaching" }));
      const attachResult = await attachSshKey({ publicKeyId: keyId });
      setState((s) => ({
        ...s,
        step: "done",
        attachResult,
      }));
      onSetupComplete();
    } catch (err: any) {
      setState((s) => ({ ...s, step: "error", error: err?.message ?? "Setup failed" }));
    }
  };

  // Still checking
  if (state.step === "checking") {
    return (
      <div className="glass-panel flex items-center gap-3 rounded-lg px-4 py-3">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground">Checking SSH key status...</span>
      </div>
    );
  }

  // Key exists and setup is done
  if (state.step === "done" && state.exists) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
          <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
          <span className="font-mono text-xs text-green-700 dark:text-green-300">
            SSH key configured
          </span>
          {state.publicKey && (
            <code className="ml-2 max-w-[300px] truncate rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {state.publicKey.slice(0, 60)}...
            </code>
          )}
          {state.attachResult && (
            <span className="font-mono text-[10px] text-muted-foreground">
              Attached: {state.attachResult.attached} VPS
              {state.attachResult.failed > 0 && (
                <span className="text-destructive"> ({state.attachResult.failed} failed)</span>
              )}
            </span>
          )}
          <button
            onClick={runFullSetup}
            className="ml-auto rounded-md border border-border px-3 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted"
          >
            Re-attach Keys
          </button>
        </div>
        {/* Show attach details if there were failures or recent attach */}
        {state.attachResult?.details && state.attachResult.details.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Attach Details
            </div>
            <div className="space-y-1">
              {state.attachResult.details.map((d) => (
                <div key={d.hostingerId} className="flex items-center gap-2 font-mono text-[10px]">
                  <span className={d.status >= 200 && d.status < 300 ? "text-green-600 dark:text-green-400" : d.status === 409 ? "text-yellow-600" : "text-destructive"}>
                    {d.status || "ERR"}
                  </span>
                  <span className="text-foreground">{d.hostname}</span>
                  <span className="text-muted-foreground">({d.hostingerId})</span>
                  {d.status !== 200 && d.status !== 204 && (
                    <span className="max-w-[400px] truncate text-muted-foreground">{d.body}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // In progress (generating, registering, attaching)
  if (state.step === "generating" || state.step === "registering" || state.step === "attaching") {
    const stepLabels: Record<string, string> = {
      generating: "Generating SSH key pair...",
      registering: "Registering key with Hostinger...",
      attaching: "Attaching key to VPS machines...",
    };
    return (
      <div className="glass-panel flex items-center gap-3 rounded-lg px-4 py-3">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="font-mono text-xs text-foreground">{stepLabels[state.step]}</span>
      </div>
    );
  }

  // Error
  if (state.step === "error") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
        <AlertTriangle size={14} className="text-destructive" />
        <span className="font-mono text-xs text-destructive">{state.error}</span>
        <button
          onClick={runFullSetup}
          className="ml-auto rounded-md border border-border px-3 py-1 font-mono text-xs text-foreground hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  // Idle — key not set up
  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
      <KeyRound size={14} className="text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1">
        <span className="font-mono text-xs text-yellow-700 dark:text-yellow-300">
          SSH key not generated.
        </span>
        <span className="ml-1 font-mono text-xs text-muted-foreground">
          Step 1: Generate key. Step 2: Deploy to each VPS using the key icon.
        </span>
      </div>
      <button
        onClick={runFullSetup}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90"
      >
        <KeyRound size={12} /> Generate SSH Key
      </button>
    </div>
  );
}

// ── Detail Field ─────────────────────────────────────────
function DetailField({
  label,
  value,
  copyable,
  muted,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  muted?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={`font-mono text-xs ${muted ? "text-muted-foreground/50" : "text-foreground"}`}
        >
          {value}
        </span>
        {copyable && value && (
          <button
            onClick={handleCopy}
            className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
            title="Copy"
          >
            {copied ? (
              <CheckCircle2 size={11} className="text-green-500" />
            ) : (
              <Copy size={11} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main VPS Page ────────────────────────────────────────
export default function VpsPage() {
  const vpsList = useQuery(api.vpsInstances.list);
  const gatewayInstances = useQuery(api.gatewayInstances.list);
  const orgs = useQuery(api.organizations.list);
  const syncFromHostinger = useAction(api.hostinger.syncVpsFromHostinger);
  const createVm = useAction(api.hostinger.createVirtualMachine);
  const updateTags = useMutation(api.vpsInstances.updateTags);
  const removeVps = useMutation(api.vpsInstances.remove);
  const removeInstance = useMutation(api.gatewayInstances.remove);

  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteVpsTarget, setDeleteVpsTarget] = useState<Id<"vpsInstances"> | null>(null);
  const [deleteInstTarget, setDeleteInstTarget] = useState<Id<"gatewayInstances"> | null>(null);
  const [expandedVps, setExpandedVps] = useState<Set<string>>(new Set());
  const [addingInstanceTo, setAddingInstanceTo] = useState<Id<"vpsInstances"> | null>(null);
  const [editingInstance, setEditingInstance] = useState<Id<"gatewayInstances"> | null>(null);
  const [expandedInstance, setExpandedInstance] = useState<Id<"gatewayInstances"> | null>(null);
  const [tagEditId, setTagEditId] = useState<Id<"vpsInstances"> | null>(null);
  const [tagInput, setTagInput] = useState("");

  // Scan state
  const [scanningVps, setScanningVps] = useState<Id<"vpsInstances"> | null>(null);
  const [scanResults, setScanResults] = useState<Map<string, ScanResult[]>>(new Map());
  const [scanError, setScanError] = useState<Map<string, string>>(new Map());

  // SSH diagnose state
  const [diagnosingVps, setDiagnosingVps] = useState<Id<"vpsInstances"> | null>(null);
  const [diagResults, setDiagResults] = useState<Map<string, Record<string, unknown>>>(new Map());

  // SSH key deploy state
  const [deployingKeyTo, setDeployingKeyTo] = useState<Id<"vpsInstances"> | null>(null);
  const [deployPassword, setDeployPassword] = useState("");
  const [deployStatus, setDeployStatus] = useState<Map<string, { ok: boolean; msg: string }>>(new Map());

  // VPS settings edit
  const [editingVps, setEditingVps] = useState<Id<"vpsInstances"> | null>(null);
  const updateVpsDetails = useMutation(api.vpsInstances.updateVpsDetails);

  // Create form state
  const [newHostname, setNewHostname] = useState("");
  const [newPlan, setNewPlan] = useState("kvm-1");
  const [newDatacenter, setNewDatacenter] = useState("nl-amsterdam-dc3");
  const [newPeriod, setNewPeriod] = useState(1);
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncFromHostinger();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createVm({
        period: newPeriod,
        plan: newPlan,
        datacenter: newDatacenter,
        hostname: newHostname,
        password: newPassword,
      });
      setShowCreate(false);
      setNewHostname("");
      setNewPassword("");
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleScanVps = async (vps: {
    _id: Id<"vpsInstances">;
    hostname: string;
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
  }) => {
    // Resolve scan target: use IP address, or fall back to hostname
    const target = vps.ipAddress?.trim() || vps.hostname?.trim();
    if (!target) {
      setScanError((prev) =>
        new Map(prev).set(
          vps._id as string,
          "Cannot scan: VPS has no IP address or hostname. Update it first.",
        ),
      );
      setExpandedVps((prev) => new Set(prev).add(vps._id as string));
      return;
    }

    setScanningVps(vps._id);
    setScanError((prev) => {
      const next = new Map(prev);
      next.delete(vps._id as string);
      return next;
    });
    setScanResults((prev) => {
      const next = new Map(prev);
      next.delete(vps._id as string);
      return next;
    });
    // Auto-expand this VPS
    setExpandedVps((prev) => new Set(prev).add(vps._id as string));
    try {
      const res = await fetch("/api/admin/scan-vps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: target,
          sshUser: vps.sshUser,
          sshPort: vps.sshPort,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError((prev) => new Map(prev).set(vps._id as string, data.error ?? "Scan failed"));
        return;
      }
      if (data.instances?.length > 0) {
        setScanResults((prev) =>
          new Map(prev).set(vps._id as string, data.instances),
        );
      } else {
        setScanError((prev) =>
          new Map(prev).set(vps._id as string, "No OpenClaw instances found on this VPS"),
        );
      }
    } catch (err: any) {
      setScanError((prev) =>
        new Map(prev).set(vps._id as string, err?.message ?? "Scan failed"),
      );
    } finally {
      setScanningVps(null);
    }
  };

  const handleDiagnose = async (vps: {
    _id: Id<"vpsInstances">;
    hostname: string;
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
  }) => {
    const target = vps.ipAddress?.trim() || vps.hostname?.trim();
    if (!target) return;
    setDiagnosingVps(vps._id);
    setExpandedVps((prev) => new Set(prev).add(vps._id as string));
    try {
      const res = await fetch("/api/admin/ssh-keys/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: target,
          sshUser: vps.sshUser,
          sshPort: vps.sshPort,
        }),
      });
      const data = await res.json();
      setDiagResults((prev) => new Map(prev).set(vps._id as string, data));
    } catch (err: any) {
      setDiagResults((prev) =>
        new Map(prev).set(vps._id as string, { error: err?.message }),
      );
    } finally {
      setDiagnosingVps(null);
    }
  };

  const handleDeployKey = async (vps: {
    _id: Id<"vpsInstances">;
    hostname: string;
    ipAddress: string;
    sshUser?: string;
    sshPort?: number;
  }) => {
    const target = vps.ipAddress?.trim() || vps.hostname?.trim();
    if (!target || !deployPassword) return;
    setDeployStatus((prev) => {
      const n = new Map(prev);
      n.delete(vps._id as string);
      return n;
    });
    try {
      const res = await fetch("/api/admin/ssh-keys/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: target,
          sshUser: vps.sshUser,
          sshPort: vps.sshPort,
          password: deployPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDeployStatus((prev) =>
          new Map(prev).set(vps._id as string, {
            ok: true,
            msg: data.verified ? "Key deployed and verified!" : "Key deployed (verification pending).",
          }),
        );
        setDeployingKeyTo(null);
        setDeployPassword("");
      } else {
        setDeployStatus((prev) =>
          new Map(prev).set(vps._id as string, { ok: false, msg: data.error ?? "Deploy failed" }),
        );
      }
    } catch (err: any) {
      setDeployStatus((prev) =>
        new Map(prev).set(vps._id as string, { ok: false, msg: err?.message ?? "Deploy failed" }),
      );
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedVps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddTag = async (
    id: Id<"vpsInstances">,
    currentTags: string[],
  ) => {
    if (!tagInput.trim()) return;
    await updateTags({ id, tags: [...currentTags, tagInput.trim()] });
    setTagInput("");
  };

  const handleRemoveTag = async (
    id: Id<"vpsInstances">,
    currentTags: string[],
    tagToRemove: string,
  ) => {
    await updateTags({
      id,
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  };

  // Group gateway instances by VPS
  const instancesByVps = new Map<string, typeof gatewayInstances>();
  if (gatewayInstances) {
    for (const inst of gatewayInstances) {
      const key = inst.vpsId as string;
      if (!instancesByVps.has(key)) instancesByVps.set(key, []);
      instancesByVps.get(key)!.push(inst);
    }
  }

  const totalInstances = gatewayInstances?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="console-title text-2xl text-foreground">
            VPS & Gateway Instances
          </h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {vpsList?.length ?? 0} VPS &middot; {totalInstances} gateway
            instance{totalInstances !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={syncing ? "animate-spin" : ""}
            />
            Sync from Hostinger
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={14} /> Create VPS
          </button>
        </div>
      </div>

      {/* SSH Key Setup Banner */}
      <SshKeySetupBanner onSetupComplete={() => {}} />

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel grid grid-cols-2 gap-3 rounded-lg p-4 sm:grid-cols-3"
        >
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Hostname
            </label>
            <input
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="my-server"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Plan
            </label>
            <input
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Datacenter
            </label>
            <input
              value={newDatacenter}
              onChange={(e) => setNewDatacenter(e.target.value)}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Period (months)
            </label>
            <input
              type="number"
              min={1}
              value={newPeriod}
              onChange={(e) => setNewPeriod(Number(e.target.value))}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* VPS Master-Detail */}
      <div className="space-y-3">
        {vpsList === undefined ? (
          <div className="glass-panel rounded-lg px-4 py-8 text-center font-mono text-xs text-muted-foreground">
            Loading...
          </div>
        ) : vpsList.length === 0 ? (
          <div className="glass-panel rounded-lg px-4 py-8 text-center font-mono text-xs text-muted-foreground">
            No VPS instances. Click &quot;Sync from Hostinger&quot; to
            import.
          </div>
        ) : (
          vpsList.map((vps) => {
            const vpsInsts = instancesByVps.get(vps._id as string) ?? [];
            const isExpanded = expandedVps.has(vps._id as string);
            const maxInst = vps.maxInstances ?? 1;

            return (
              <div
                key={vps._id}
                className="glass-panel overflow-hidden rounded-lg"
              >
                {/* VPS Header Row */}
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/30"
                  onClick={() => toggleExpand(vps._id as string)}
                >
                  <span className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  <Server size={14} className="text-muted-foreground" />
                  <span className="font-mono text-sm font-medium text-foreground">
                    {vps.hostname}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {vps.ipAddress}
                  </span>
                  <StatusBadge status={vps.status} />
                  <CapacityBar
                    used={vps.instanceCount}
                    max={maxInst}
                    plan={vps.plan}
                  />

                  {/* Tags inline */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(vps.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 rounded-full bg-accent/30 px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground"
                      >
                        {tag}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(
                              vps._id,
                              vps.tags ?? [],
                              tag,
                            );
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {tagEditId === vps._id ? (
                      <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddTag(vps._id, vps.tags ?? []);
                          }
                          if (e.key === "Escape") setTagEditId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="w-16 rounded border border-border bg-input px-1 py-0.5 font-mono text-[10px] outline-none focus:ring-1 focus:ring-ring"
                        placeholder="tag"
                      />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagEditId(vps._id);
                          setTagInput("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Tag size={11} />
                      </button>
                    )}
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVps(editingVps === vps._id ? null : vps._id);
                      }}
                      className={`rounded p-1 transition ${
                        editingVps === vps._id
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      title="VPS Settings (IP, SSH, Capacity)"
                    >
                      <Settings2 size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeployingKeyTo(deployingKeyTo === vps._id ? null : vps._id);
                        setExpandedVps((prev) => new Set(prev).add(vps._id as string));
                      }}
                      className={`rounded p-1 transition ${
                        deployingKeyTo === vps._id
                          ? "bg-yellow-500/10 text-yellow-600"
                          : "text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-600"
                      }`}
                      title="Deploy SSH key to this VPS"
                    >
                      <KeyRound size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScanVps(vps);
                      }}
                      disabled={scanningVps === vps._id}
                      className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                      title="Scan for OpenClaw instances"
                    >
                      <Radar
                        size={13}
                        className={scanningVps === vps._id ? "animate-pulse" : ""}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteVpsTarget(vps._id);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete VPS"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* VPS Settings Edit Panel */}
                {editingVps === vps._id && (
                  <VpsSettingsPanel
                    vps={vps}
                    onSave={async (updates) => {
                      await updateVpsDetails({ id: vps._id, ...updates });
                      setEditingVps(null);
                    }}
                    onClose={() => setEditingVps(null)}
                  />
                )}

                {/* Deploy SSH Key Panel */}
                {deployingKeyTo === vps._id && (
                  <div
                    className="border-t border-border/50 bg-yellow-500/5 px-4 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-700 dark:text-yellow-300">
                      <KeyRound size={12} className="mr-1 inline" />
                      Deploy SSH Key to {vps.hostname}
                    </div>
                    <p className="mb-3 font-mono text-[10px] text-muted-foreground">
                      Enter the VPS root password to deploy the SSH key. This is a one-time operation.
                    </p>
                    {deployStatus.get(vps._id as string) && (
                      <div
                        className={`mb-3 rounded-md px-3 py-2 font-mono text-xs ${
                          deployStatus.get(vps._id as string)!.ok
                            ? "bg-green-500/10 text-green-700 dark:text-green-300"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {deployStatus.get(vps._id as string)!.msg}
                      </div>
                    )}
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Root Password
                        </label>
                        <input
                          type="password"
                          value={deployPassword}
                          onChange={(e) => setDeployPassword(e.target.value)}
                          placeholder="VPS root password"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleDeployKey(vps);
                          }}
                          className="w-64 rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <button
                        onClick={() => handleDeployKey(vps)}
                        disabled={!deployPassword}
                        className="rounded-md bg-yellow-600 px-4 py-1.5 font-mono text-xs text-white hover:bg-yellow-700 disabled:opacity-50"
                      >
                        Deploy Key
                      </button>
                      <button
                        onClick={() => {
                          setDeployingKeyTo(null);
                          setDeployPassword("");
                        }}
                        className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded: Gateway Instances */}
                {isExpanded && (
                  <div className="border-t border-border/50">
                    {vpsInsts.length === 0 && addingInstanceTo !== vps._id ? (
                      <div className="px-8 py-4 text-center font-mono text-xs text-muted-foreground">
                        No gateway instances on this VPS.
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/30 text-left">
                            {[
                              "Name",
                              "Org",
                              "Port",
                              "Status",
                              "URL",
                              "Agents",
                              "Actions",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground first:pl-8"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vpsInsts.map((inst) => {
                            if (editingInstance === inst._id) {
                              return (
                                <EditInstanceRow
                                  key={inst._id}
                                  inst={inst}
                                  vpsIp={vps.ipAddress}
                                  orgs={orgs ?? []}
                                  onClose={() =>
                                    setEditingInstance(null)
                                  }
                                />
                              );
                            }
                            const resolvedUrl =
                              inst.url ??
                              `ws://${vps.ipAddress || vps.hostname}:${inst.port}`;
                            const isDetailOpen = expandedInstance === inst._id;
                            return (
                              <React.Fragment key={inst._id}>
                                <tr
                                  className="cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/20"
                                  onClick={() =>
                                    setExpandedInstance(
                                      isDetailOpen ? null : inst._id,
                                    )
                                  }
                                >
                                  <td className="py-2 pl-8 pr-4 font-mono text-xs text-foreground">
                                    <div className="flex items-center gap-1.5">
                                      {isDetailOpen ? (
                                        <ChevronDown size={12} className="text-primary/60" />
                                      ) : (
                                        <Zap size={12} className="text-primary/60" />
                                      )}
                                      {inst.name}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                    {inst.orgName ?? "—"}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs text-foreground">
                                    :{inst.port}
                                  </td>
                                  <td className="px-4 py-2">
                                    <StatusBadge status={inst.status} />
                                  </td>
                                  <td
                                    className="max-w-[200px] truncate px-4 py-2 font-mono text-[10px] text-muted-foreground"
                                    title={resolvedUrl}
                                  >
                                    {resolvedUrl}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                                    {inst.agentCount ?? "—"}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingInstance(inst._id);
                                        }}
                                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="Edit"
                                      >
                                        <Settings2 size={13} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteInstTarget(inst._id);
                                        }}
                                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        title="Remove"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isDetailOpen && (
                                  <tr className="border-b border-border/30">
                                    <td colSpan={7} className="bg-muted/10 px-8 py-4">
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
                                        <DetailField label="Instance Name" value={inst.name} />
                                        <DetailField label="Organization" value={inst.orgName ?? "—"} />
                                        <DetailField label="Status" value={inst.status} />
                                        <DetailField label="Port" value={`:${inst.port}`} />
                                        <DetailField label="Gateway URL" value={resolvedUrl} copyable />
                                        <DetailField label="Agent Count" value={String(inst.agentCount ?? 0)} />
                                        <DetailField
                                          label="Auth Token"
                                          value={inst.token ? "••••••••" : "Not set"}
                                          muted={!inst.token}
                                        />
                                        <DetailField
                                          label="State Directory"
                                          value={inst.stateDir ?? "Not set"}
                                          muted={!inst.stateDir}
                                        />
                                        <DetailField
                                          label="VPS Host"
                                          value={`${vps.hostname} (${vps.ipAddress || "no IP"})`}
                                        />
                                        <DetailField
                                          label="Last Updated"
                                          value={inst.updatedAt ? new Date(inst.updatedAt).toLocaleString() : "—"}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Scan error */}
                    {scanError.get(vps._id as string) && (
                      <div className="border-t border-border/30 px-4 py-3">
                        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
                          <span className="font-mono text-xs text-destructive">
                            {scanError.get(vps._id as string)}
                          </span>
                          <button
                            onClick={() => handleDiagnose(vps)}
                            disabled={diagnosingVps === vps._id}
                            className="rounded-md border border-destructive/30 px-2 py-0.5 font-mono text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          >
                            {diagnosingVps === vps._id ? "Diagnosing..." : "Diagnose SSH"}
                          </button>
                          <button
                            onClick={() =>
                              setScanError((prev) => {
                                const next = new Map(prev);
                                next.delete(vps._id as string);
                                return next;
                              })
                            }
                            className="ml-auto text-destructive/50 hover:text-destructive"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SSH Diagnostic results */}
                    {diagResults.get(vps._id as string) && (
                      <div className="border-t border-border/30 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            SSH Diagnostic
                          </span>
                          <button
                            onClick={() => setDiagResults((prev) => { const n = new Map(prev); n.delete(vps._id as string); return n; })}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <pre className="max-h-[300px] overflow-auto rounded-md bg-black/80 p-3 font-mono text-[10px] text-green-400 leading-relaxed">
                          {JSON.stringify(diagResults.get(vps._id as string), null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Scan results */}
                    {scanResults.get(vps._id as string) && (
                      <ScanResultsPanel
                        vpsId={vps._id}
                        vpsHostname={vps.hostname}
                        vpsIp={vps.ipAddress}
                        results={scanResults.get(vps._id as string)!}
                        existingInstances={vpsInsts.map((i) => ({ _id: i._id, port: i.port }))}
                        orgs={orgs ?? []}
                        onClose={() =>
                          setScanResults((prev) => {
                            const next = new Map(prev);
                            next.delete(vps._id as string);
                            return next;
                          })
                        }
                      />
                    )}

                    {/* Add Instance Form or Button */}
                    {addingInstanceTo === vps._id ? (
                      <AddInstanceForm
                        vpsId={vps._id}
                        vpsHostname={vps.hostname}
                        vpsIp={vps.ipAddress}
                        existingPorts={vpsInsts.map((i) => i.port)}
                        orgs={orgs ?? []}
                        onClose={() => setAddingInstanceTo(null)}
                      />
                    ) : (
                      <div className="border-t border-border/30 px-8 py-2">
                        <button
                          onClick={() => setAddingInstanceTo(vps._id)}
                          disabled={vpsInsts.length >= maxInst}
                          className="flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:opacity-50"
                        >
                          <Plus size={12} />
                          {vpsInsts.length >= maxInst
                            ? `At capacity (${vpsInsts.length}/${maxInst})`
                            : "Add Instance"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete VPS confirm */}
      <ConfirmDialog
        open={deleteVpsTarget !== null}
        title="Delete VPS Record"
        message="Remove this VPS record from the database. All gateway instances on it must be removed first. This does not delete the actual server."
        onConfirm={async () => {
          if (deleteVpsTarget) {
            try {
              await removeVps({ id: deleteVpsTarget });
            } catch (err: any) {
              alert(err?.message ?? "Failed to delete VPS");
            }
          }
          setDeleteVpsTarget(null);
        }}
        onCancel={() => setDeleteVpsTarget(null)}
      />

      {/* Delete Instance confirm */}
      <ConfirmDialog
        open={deleteInstTarget !== null}
        title="Remove Gateway Instance"
        message="Remove this gateway instance record. Connected users will lose access."
        onConfirm={async () => {
          if (deleteInstTarget) await removeInstance({ id: deleteInstTarget });
          setDeleteInstTarget(null);
        }}
        onCancel={() => setDeleteInstTarget(null)}
      />
    </div>
  );
}
