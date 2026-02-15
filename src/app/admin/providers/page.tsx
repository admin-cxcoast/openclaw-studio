"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { SensitiveField } from "@/features/admin/components/SensitiveField";
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function ProvidersPage() {
  const providers = useQuery(api.providers.list);
  const createProvider = useMutation(api.providers.create);
  const updateProvider = useMutation(api.providers.update);
  const removeProvider = useMutation(api.providers.remove);
  const upsertCred = useMutation(api.providerCredentials.upsert);

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Id<"providers"> | null>(null);

  // Create form
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"llm" | "tts" | "stt" | "image">("llm");

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProvider({
      slug: newSlug,
      name: newName,
      type: newType,
      isEnabled: true,
    });
    setNewSlug("");
    setNewName("");
    setShowCreate(false);
  };

  const grouped = providers
    ? {
        llm: providers.filter((p) => p.type === "llm"),
        tts: providers.filter((p) => p.type === "tts"),
        stt: providers.filter((p) => p.type === "stt"),
        image: providers.filter((p) => p.type === "image"),
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">Providers</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={14} /> Add Provider
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel flex items-end gap-3 rounded-lg p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Slug
            </label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="my-provider"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Name
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="My Provider"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Type
            </label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as typeof newType)}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="llm">LLM</option>
              <option value="tts">TTS</option>
              <option value="stt">STT</option>
              <option value="image">Image</option>
            </select>
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
        Object.entries(grouped).map(([type, list]) =>
          list.length === 0 ? null : (
            <div key={type} className="space-y-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {type.toUpperCase()} Providers
              </h2>
              <div className="grid gap-2">
                {list.map((p) => (
                  <ProviderCard
                    key={p._id}
                    provider={p}
                    expanded={expanded.has(p._id)}
                    onToggle={() => toggle(p._id)}
                    onToggleEnabled={(enabled) =>
                      updateProvider({ id: p._id, isEnabled: enabled })
                    }
                    onDelete={() => setDeleteTarget(p._id)}
                    onSaveCredential={async (key, value) => {
                      await upsertCred({
                        providerId: p._id,
                        key,
                        value,
                        sensitive: true,
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          ),
        )
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Provider"
        message="This will also delete all associated credentials and models."
        onConfirm={async () => {
          if (deleteTarget) await removeProvider({ id: deleteTarget });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ProviderCard({
  provider,
  expanded,
  onToggle,
  onToggleEnabled,
  onDelete,
  onSaveCredential,
}: {
  provider: {
    _id: Id<"providers">;
    slug: string;
    name: string;
    type: string;
    isEnabled: boolean;
  };
  expanded: boolean;
  onToggle: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  onSaveCredential: (key: string, value: string) => Promise<void>;
}) {
  const hasKey = useQuery(api.providerCredentials.hasKey, { providerId: provider._id });
  const creds = useQuery(
    api.providerCredentials.list,
    expanded ? { providerId: provider._id } : "skip",
  );
  const revealCred = useMutation(api.providerCredentials.revealMut);
  const removeCred = useMutation(api.providerCredentials.remove);
  const testKey = useAction(api.providers.testApiKey);
  const [showAddForm, setShowAddForm] = useState(false);
  const [credKey, setCredKey] = useState("api_key");
  const [credValue, setCredValue] = useState("");
  const [editingCredId, setEditingCredId] = useState<Id<"providerCredentials"> | null>(null);
  const [editValue, setEditValue] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const hasCredentials = creds && creds.length > 0;

  return (
    <div className="glass-panel overflow-hidden rounded-lg">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="text-muted-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="flex-1 font-mono text-sm text-foreground">
          {provider.name}
        </span>
        {hasKey !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
              hasKey
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            }`}
          >
            {hasKey ? "key set" : "no key"}
          </span>
        )}
        <span className="rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[10px] uppercase text-accent-foreground">
          {provider.type}
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={provider.isEnabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="accent-primary"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            Enabled
          </span>
        </label>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Credentials
          </p>
          {creds === undefined ? (
            <p className="font-mono text-xs text-muted-foreground">
              Loading...
            </p>
          ) : (
            <>
              {creds.map((c) => (
                <div
                  key={c._id}
                  className="mb-2 flex items-center gap-2 font-mono text-xs"
                >
                  <span className="text-muted-foreground">{c.key}:</span>
                  {editingCredId === c._id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 rounded border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                        placeholder="new value"
                        type="password"
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          if (editValue.trim()) {
                            await onSaveCredential(c.key, editValue);
                          }
                          setEditingCredId(null);
                          setEditValue("");
                        }}
                        className="rounded bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingCredId(null);
                          setEditValue("");
                        }}
                        className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {c.sensitive ? (
                        <SensitiveField
                          maskedValue={c.value}
                          onReveal={async () => {
                            const real = await revealCred({ id: c._id });
                            return real;
                          }}
                        />
                      ) : (
                        <code>{c.value}</code>
                      )}
                      <button
                        onClick={() => {
                          setEditingCredId(c._id);
                          setEditValue("");
                        }}
                        className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Edit credential"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          await removeCred({ id: c._id });
                        }}
                        className="rounded p-0.5 text-muted-foreground transition hover:text-destructive"
                        title="Delete credential"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              ))}

              {hasCredentials && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setTesting(true);
                      setTestResult(null);
                      try {
                        const result = await testKey({ providerId: provider._id });
                        setTestResult(result);
                        setTimeout(() => setTestResult(null), result.success ? 4000 : 8000);
                      } catch (err) {
                        setTestResult({
                          success: false,
                          message: err instanceof Error ? err.message : "Test failed",
                        });
                        setTimeout(() => setTestResult(null), 8000);
                      } finally {
                        setTesting(false);
                      }
                    }}
                    disabled={testing}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {testing ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Zap size={11} />
                    )}
                    {testing ? "Testing..." : "Test Key"}
                  </button>
                  {testResult && (
                    <span
                      className={`flex items-center gap-1 font-mono text-[10px] ${
                        testResult.success
                          ? "text-green-600 dark:text-green-400"
                          : "text-destructive"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 size={11} />
                      ) : (
                        <AlertTriangle size={11} />
                      )}
                      {testResult.message}
                    </span>
                  )}
                </div>
              )}

              {!hasCredentials && !showAddForm && (
                <button
                  onClick={() => {
                    setShowAddForm(true);
                    setCredKey("api_key");
                    setCredValue("");
                  }}
                  className="mt-1 flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-foreground hover:text-foreground"
                >
                  <Plus size={11} /> Add API Key
                </button>
              )}

              {!hasCredentials && showAddForm && (
                <div className="mt-2 flex items-end gap-2">
                  <input
                    value={credKey}
                    onChange={(e) => setCredKey(e.target.value)}
                    className="rounded border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="key"
                  />
                  <input
                    value={credValue}
                    onChange={(e) => setCredValue(e.target.value)}
                    className="flex-1 rounded border border-border bg-input px-2 py-1 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
                    placeholder="value"
                    type="password"
                  />
                  <button
                    onClick={async () => {
                      if (credKey.trim() && credValue.trim()) {
                        await onSaveCredential(credKey, credValue);
                        setCredValue("");
                        setCredKey("");
                        setShowAddForm(false);
                      }
                    }}
                    className="rounded bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setCredValue("");
                    }}
                    className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
