"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { Plus, RefreshCw, Trash2, Brain, Eye, Wrench, Zap } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function ModelsPage() {
  const providers = useQuery(api.providers.list);
  const models = useQuery(api.models.list);
  const createModel = useMutation(api.models.create);
  const updateModel = useMutation(api.models.update);
  const removeModel = useMutation(api.models.remove);
  const syncCatalog = useAction(api.models.syncCatalog);

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Id<"models"> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Create form
  const [newProviderId, setNewProviderId] = useState<string>("");
  const [newModelId, setNewModelId] = useState("");
  const [newName, setNewName] = useState("");
  const [newContextWindow, setNewContextWindow] = useState<number | "">("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderId) return;
    await createModel({
      providerId: newProviderId as Id<"providers">,
      modelId: newModelId,
      name: newName,
      isEnabled: true,
      contextWindow: newContextWindow ? Number(newContextWindow) : undefined,
    });
    setNewModelId("");
    setNewName("");
    setNewContextWindow("");
    setShowCreate(false);
  };

  const grouped = models && providers
    ? providers.map((p) => ({
        provider: p,
        models: models.filter((m) => m.providerId === p._id),
      }))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">
          Model Catalog
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setSyncing(true);
              setSyncResult(null);
              try {
                const result = await syncCatalog();
                const parts: string[] = [];
                if (result.added > 0) {
                  parts.push(`Added ${result.added} model${result.added > 1 ? "s" : ""}`);
                } else {
                  parts.push("Catalog is up to date");
                }
                if (result.errors.length > 0) {
                  parts.push(`Errors: ${result.errors.join("; ")}`);
                }
                setSyncResult(parts.join(". "));
                setTimeout(() => setSyncResult(null), result.errors.length > 0 ? 8000 : 3000);
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Update Catalog"}
          </button>
          {syncResult && (
            <span className={`max-w-xs truncate font-mono text-[10px] ${syncResult.includes("Errors") ? "text-destructive" : "text-primary"}`}>
              {syncResult}
            </span>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={14} /> Add Model
          </button>
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel flex items-end gap-3 rounded-lg p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Provider
            </label>
            <select
              value={newProviderId}
              onChange={(e) => setNewProviderId(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select...</option>
              {providers?.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Model ID
            </label>
            <input
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="claude-sonnet-4-5-20250929"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Display Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Claude Sonnet 4.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Context Window
            </label>
            <input
              type="number"
              value={newContextWindow}
              onChange={(e) =>
                setNewContextWindow(
                  e.target.value ? Number(e.target.value) : "",
                )
              }
              className="w-28 rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="200000"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90"
          >
            Create
          </button>
        </form>
      )}

      {grouped === null ? (
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
      ) : (
        grouped.map(
          ({ provider, models: pModels }) =>
            pModels.length > 0 && (
              <div key={provider._id} className="space-y-2">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {provider.name}
                </h2>
                <div className="glass-panel overflow-hidden rounded-lg">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border text-left">
                        {[
                          "Model ID",
                          "Name",
                          "Context",
                          "Capabilities",
                          "Enabled",
                          "Default",
                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pModels.map((m) => (
                        <tr
                          key={m._id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="truncate px-4 py-2 font-mono text-xs text-foreground" title={m.modelId}>
                            {m.modelId}
                          </td>
                          <td className="truncate px-4 py-2 font-mono text-sm text-foreground" title={m.name}>
                            {m.name}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground tabular-nums">
                            {m.contextWindow
                              ? `${(m.contextWindow / 1000).toFixed(0)}k`
                              : "—"}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              {m.capabilities?.reasoning && (
                                <CapBadge icon={Brain} label="Reasoning" />
                              )}
                              {m.capabilities?.vision && (
                                <CapBadge icon={Eye} label="Vision" />
                              )}
                              {m.capabilities?.toolCalling && (
                                <CapBadge icon={Wrench} label="Tools" />
                              )}
                              {m.capabilities?.streaming && (
                                <CapBadge icon={Zap} label="Stream" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={m.isEnabled}
                              onChange={(e) =>
                                updateModel({
                                  id: m._id,
                                  isEnabled: e.target.checked,
                                })
                              }
                              className="accent-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={m.isDefault ?? false}
                              onChange={(e) =>
                                updateModel({
                                  id: m._id,
                                  isDefault: e.target.checked,
                                })
                              }
                              className="accent-primary"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => setDeleteTarget(m._id)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
        )
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Model"
        message="Remove this model from the catalog."
        onConfirm={async () => {
          if (deleteTarget) await removeModel({ id: deleteTarget });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CapBadge({
  icon: Icon,
  label,
}: {
  icon: typeof Brain;
  label: string;
}) {
  return (
    <span
      title={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded bg-accent/20 text-accent-foreground"
    >
      <Icon size={11} strokeWidth={1.8} />
    </span>
  );
}
