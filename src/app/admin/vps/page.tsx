"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import {
  RefreshCw,
  Plus,
  Trash2,
  Tag,
  X,
} from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function VpsPage() {
  const instances = useQuery(api.vpsInstances.list);
  const orgs = useQuery(api.organizations.list);
  const assignToOrg = useMutation(api.vpsInstances.assignToOrg);
  const updateTags = useMutation(api.vpsInstances.updateTags);
  const removeVps = useMutation(api.vpsInstances.remove);
  const syncFromHostinger = useAction(api.hostinger.syncVpsFromHostinger);
  const createVm = useAction(api.hostinger.createVirtualMachine);

  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"vpsInstances"> | null>(null);
  const [tagEditId, setTagEditId] = useState<Id<"vpsInstances"> | null>(null);
  const [tagInput, setTagInput] = useState("");

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

  const handleAddTag = async (id: Id<"vpsInstances">, currentTags: string[]) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">
          VPS Instances
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
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

      <div className="glass-panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                {["Hostname", "IP", "Region", "Plan", "Status", "Org", "Tags", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {instances === undefined ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                  >
                    Loading...
                  </td>
                </tr>
              ) : instances.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                  >
                    No VPS instances. Click &quot;Sync from Hostinger&quot; to import.
                  </td>
                </tr>
              ) : (
                instances.map((vps) => (
                  <tr
                    key={vps._id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                      {vps.hostname}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {vps.ipAddress}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {vps.region ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {vps.plan ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <VpsStatusBadge status={vps.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={vps.orgId ?? ""}
                        onChange={(e) =>
                          assignToOrg({
                            id: vps._id,
                            orgId: e.target.value
                              ? (e.target.value as Id<"organizations">)
                              : undefined,
                          })
                        }
                        className="rounded border border-border bg-input px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Unassigned</option>
                        {orgs?.map((o) => (
                          <option key={o._id} value={o._id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {(vps.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-0.5 rounded-full bg-accent/30 px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground"
                          >
                            {tag}
                            <button
                              onClick={() =>
                                handleRemoveTag(vps._id, vps.tags ?? [], tag)
                              }
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
                                handleAddTag(vps._id, vps.tags ?? []);
                              }
                              if (e.key === "Escape") setTagEditId(null);
                            }}
                            autoFocus
                            className="w-16 rounded border border-border bg-input px-1 py-0.5 font-mono text-[10px] outline-none focus:ring-1 focus:ring-ring"
                            placeholder="tag"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setTagEditId(vps._id);
                              setTagInput("");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Tag size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setDeleteTarget(vps._id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete VPS Instance"
        message="Remove this VPS record from the database. This does not delete the actual server."
        onConfirm={async () => {
          if (deleteTarget) await removeVps({ id: deleteTarget });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function VpsStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-green-500/10 text-green-600 dark:text-green-400",
    provisioning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    stopped: "bg-muted text-muted-foreground",
    error: "bg-destructive/10 text-destructive",
    unassigned: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] capitalize ${colors[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
