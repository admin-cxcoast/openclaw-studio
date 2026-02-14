"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Puzzle,
  Download,
  Loader2,
} from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"] as const;
const CATEGORY_OPTIONS = ["mcp", "prompt", "workflow"] as const;
const RUNTIME_OPTIONS = ["node", "python", "none"] as const;

const categoryColors: Record<string, string> = {
  mcp: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  prompt: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  workflow: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

type Category = (typeof CATEGORY_OPTIONS)[number];
type Runtime = (typeof RUNTIME_OPTIONS)[number];

export default function SkillsPage() {
  const skills = useQuery(api.skills.list);
  const createSkill = useMutation(api.skills.create);
  const updateSkill = useMutation(api.skills.update);
  const removeSkill = useMutation(api.skills.remove);

  const importSkill = useMutation(api.skills.importFromContent);

  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Id<"skills"> | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  type DiscoveredSkill = {
    name: string;
    displayName: string;
    description: string;
    category: "mcp" | "prompt" | "workflow";
    runtime: "node" | "python" | "none";
    content: string;
    sourceRepo?: string;
    entryPoint?: string;
    dependencies?: string;
    filePath: string;
  };
  const [discovered, setDiscovered] = useState<DiscoveredSkill[]>([]);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [importingSelected, setImportingSelected] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("mcp");
  const [newRuntime, setNewRuntime] = useState<Runtime>("node");
  const [newSourceRepo, setNewSourceRepo] = useState("");
  const [newEntryPoint, setNewEntryPoint] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDependencies, setNewDependencies] = useState("");
  const [newPlans, setNewPlans] = useState<Set<string>>(
    new Set(PLAN_OPTIONS),
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleNewPlan = (plan: string) => {
    setNewPlans((prev) => {
      const next = new Set(prev);
      next.has(plan) ? next.delete(plan) : next.add(plan);
      return next;
    });
  };

  const resetCreate = () => {
    setNewName("");
    setNewDisplayName("");
    setNewCategory("mcp");
    setNewRuntime("node");
    setNewSourceRepo("");
    setNewEntryPoint("");
    setNewDescription("");
    setNewContent("");
    setNewDependencies("");
    setNewPlans(new Set(PLAN_OPTIONS));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSkill({
      name: newName,
      displayName: newDisplayName,
      description: newDescription,
      category: newCategory,
      content: newContent,
      runtime: newRuntime,
      sourceRepo: newSourceRepo || undefined,
      entryPoint: newEntryPoint || undefined,
      dependencies: newDependencies || undefined,
      isEnabled: true,
      plans: [...newPlans],
    });
    resetCreate();
    setShowCreate(false);
  };

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setImportError("");
    setDiscovered([]);
    setSelectedImports(new Set());
    try {
      const res = await fetch("/api/admin/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: importUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return;
      }
      if (data.skills.length === 0) {
        setImportError(data.message ?? "No skills found");
        return;
      }
      setDiscovered(data.skills);
      setSelectedImports(new Set(data.skills.map((_: unknown, i: number) => i)));
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportSelected = async () => {
    setImportingSelected(true);
    try {
      for (const idx of selectedImports) {
        const s = discovered[idx];
        await importSkill({
          name: s.name,
          displayName: s.displayName,
          description: s.description,
          category: s.category,
          content: s.content,
          runtime: s.runtime,
          sourceRepo: s.sourceRepo,
          entryPoint: s.entryPoint,
          dependencies: s.dependencies,
        });
      }
      setShowImport(false);
      setDiscovered([]);
      setImportUrl("");
      setSelectedImports(new Set());
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingSelected(false);
    }
  };

  const toggleImportSelection = (idx: number) => {
    setSelectedImports((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="console-title text-2xl text-foreground">
            Skills Catalog
          </h1>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {skills?.length ?? 0} skill{skills?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowImport(!showImport);
              setShowCreate(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
          >
            <Download size={14} /> Import from GitHub
          </button>
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setShowImport(false);
            }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={14} /> Add Skill
          </button>
        </div>
      </div>

      {/* Import from GitHub */}
      {showImport && (
        <div className="glass-panel space-y-3 rounded-lg p-4">
          <form onSubmit={handleDiscover} className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                GitHub Repository URL
              </label>
              <input
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                required
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="https://github.com/org/skills-repo"
              />
            </div>
            <button
              type="submit"
              disabled={importing}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {importing ? "Scanning..." : "Discover Skills"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImport(false);
                setDiscovered([]);
                setImportUrl("");
                setImportError("");
              }}
              className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </form>

          {importError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {importError}
            </div>
          )}

          {discovered.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Discovered {discovered.length} skill
                  {discovered.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={handleImportSelected}
                  disabled={importingSelected || selectedImports.size === 0}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {importingSelected ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Download size={12} />
                  )}
                  Import Selected ({selectedImports.size})
                </button>
              </div>
              <div className="space-y-1">
                {discovered.map((s, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={selectedImports.has(idx)}
                      onChange={() => toggleImportSelection(idx)}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-mono text-xs text-foreground">
                        {s.displayName}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {s.name} &middot; {s.category} &middot; {s.filePath}
                      </div>
                    </div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${categoryColors[s.category] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {s.category}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel space-y-4 rounded-lg p-4"
        >
          {/* Row 1: Name, Display Name, Category */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Name (slug)
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="web-search"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Display Name
              </label>
              <input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                required
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="Web Search"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as Category)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Runtime, Source Repo, Entry Point */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Runtime
              </label>
              <select
                value={newRuntime}
                onChange={(e) => setNewRuntime(e.target.value as Runtime)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {RUNTIME_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Source Repo
              </label>
              <input
                value={newSourceRepo}
                onChange={(e) => setNewSourceRepo(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="https://github.com/org/repo"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Entry Point
              </label>
              <input
                value={newEntryPoint}
                onChange={(e) => setNewEntryPoint(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="index.ts"
              />
            </div>
          </div>

          {/* Row 3: Description */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Description
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              required
              rows={2}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="What this skill does..."
            />
          </div>

          {/* Row 4: Content */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Content
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
              rows={8}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Skill content (SKILL.md or code)..."
            />
          </div>

          {/* Row 5: Dependencies */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Dependencies
            </label>
            <input
              value={newDependencies}
              onChange={(e) => setNewDependencies(e.target.value)}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="comma-separated: axios, cheerio"
            />
          </div>

          {/* Row 6: Plans */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Available Plans
            </label>
            <div className="flex items-center gap-3">
              {PLAN_OPTIONS.map((plan) => (
                <label key={plan} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={newPlans.has(plan)}
                    onChange={() => toggleNewPlan(plan)}
                    className="accent-primary"
                  />
                  <span className="font-mono text-xs text-foreground capitalize">
                    {plan}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                resetCreate();
                setShowCreate(false);
              }}
              className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Skills Table */}
      {skills === undefined ? (
        <div className="glass-panel rounded-lg px-4 py-8 text-center font-mono text-xs text-muted-foreground">
          Loading...
        </div>
      ) : skills.length === 0 ? (
        <div className="glass-panel rounded-lg px-4 py-8 text-center font-mono text-xs text-muted-foreground">
          <Puzzle
            size={24}
            className="mx-auto mb-2 text-muted-foreground/40"
          />
          No skills yet. Click &quot;Add Skill&quot; to create one.
        </div>
      ) : (
        <div className="glass-panel overflow-hidden rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                {["Name", "Category", "Runtime", "Plans", "Enabled", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => {
                const isExpanded = expanded.has(skill._id);
                return (
                  <SkillRow
                    key={skill._id}
                    skill={skill}
                    isExpanded={isExpanded}
                    onToggle={() => toggle(skill._id)}
                    onToggleEnabled={(enabled) =>
                      updateSkill({ id: skill._id, isEnabled: enabled })
                    }
                    onDelete={() => setDeleteTarget(skill._id)}
                    onSave={async (updates) => {
                      await updateSkill({ id: skill._id, ...updates });
                      toggle(skill._id);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Skill"
        message="This will remove the skill from all instances."
        onConfirm={async () => {
          if (deleteTarget) await removeSkill({ id: deleteTarget });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Skill Row ─────────────────────────────────────────────
function SkillRow({
  skill,
  isExpanded,
  onToggle,
  onToggleEnabled,
  onDelete,
  onSave,
}: {
  skill: {
    _id: Id<"skills">;
    name: string;
    displayName: string;
    description: string;
    category: string;
    runtime?: string;
    sourceRepo?: string;
    entryPoint?: string;
    content: string;
    dependencies?: string;
    isEnabled: boolean;
    plans: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  onSave: (updates: {
    displayName?: string;
    description?: string;
    category?: "mcp" | "prompt" | "workflow";
    runtime?: "node" | "python" | "none";
    sourceRepo?: string;
    entryPoint?: string;
    content?: string;
    dependencies?: string;
    plans?: string[];
  }) => Promise<void>;
}) {
  // Edit state
  const [editDisplayName, setEditDisplayName] = useState(skill.displayName);
  const [editDescription, setEditDescription] = useState(skill.description);
  const [editCategory, setEditCategory] = useState(skill.category as Category);
  const [editRuntime, setEditRuntime] = useState(
    (skill.runtime ?? "none") as Runtime,
  );
  const [editSourceRepo, setEditSourceRepo] = useState(
    skill.sourceRepo ?? "",
  );
  const [editEntryPoint, setEditEntryPoint] = useState(
    skill.entryPoint ?? "",
  );
  const [editContent, setEditContent] = useState(skill.content);
  const [editDependencies, setEditDependencies] = useState(
    skill.dependencies ?? "",
  );
  const [editPlans, setEditPlans] = useState<Set<string>>(
    new Set(skill.plans),
  );
  const [saving, setSaving] = useState(false);

  const toggleEditPlan = (plan: string) => {
    setEditPlans((prev) => {
      const next = new Set(prev);
      next.has(plan) ? next.delete(plan) : next.add(plan);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        displayName: editDisplayName,
        description: editDescription,
        category: editCategory,
        runtime: editRuntime,
        sourceRepo: editSourceRepo || undefined,
        entryPoint: editEntryPoint || undefined,
        content: editContent,
        dependencies: editDependencies || undefined,
        plans: [...editPlans],
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset edit state when expanding
  const handleToggle = () => {
    if (!isExpanded) {
      setEditDisplayName(skill.displayName);
      setEditDescription(skill.description);
      setEditCategory(skill.category as Category);
      setEditRuntime((skill.runtime ?? "none") as Runtime);
      setEditSourceRepo(skill.sourceRepo ?? "");
      setEditEntryPoint(skill.entryPoint ?? "");
      setEditContent(skill.content);
      setEditDependencies(skill.dependencies ?? "");
      setEditPlans(new Set(skill.plans));
    }
    onToggle();
  };

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/20"
        onClick={handleToggle}
      >
        <td className="px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {isExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </span>
            <div>
              <div className="font-mono text-sm text-foreground">
                {skill.displayName}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {skill.name}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${categoryColors[skill.category] ?? "bg-muted text-muted-foreground"}`}
          >
            {skill.category}
          </span>
        </td>
        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
          {skill.runtime ?? "—"}
        </td>
        <td className="px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {skill.plans.map((plan) => (
              <span
                key={plan}
                className="inline-block rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] capitalize text-accent-foreground"
              >
                {plan}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-2">
          <input
            type="checkbox"
            checked={skill.isEnabled}
            onChange={(e) => {
              e.stopPropagation();
              onToggleEnabled(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="accent-primary"
          />
        </td>
        <td className="px-4 py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={13} />
          </button>
        </td>
      </tr>

      {/* Expanded edit row */}
      {isExpanded && (
        <tr className="border-b border-border/30 bg-muted/10">
          <td colSpan={6} className="px-8 py-4">
            <div className="max-w-3xl space-y-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Edit Skill — {skill.name}
              </div>

              {/* Row 1: Display Name, Category, Runtime */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Display Name
                  </label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) =>
                      setEditCategory(e.target.value as Category)
                    }
                    className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Runtime
                  </label>
                  <select
                    value={editRuntime}
                    onChange={(e) =>
                      setEditRuntime(e.target.value as Runtime)
                    }
                    className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    {RUNTIME_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Source Repo, Entry Point */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Source Repo
                  </label>
                  <input
                    value={editSourceRepo}
                    onChange={(e) => setEditSourceRepo(e.target.value)}
                    className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="https://github.com/org/repo"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Entry Point
                  </label>
                  <input
                    value={editEntryPoint}
                    onChange={(e) => setEditEntryPoint(e.target.value)}
                    className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    placeholder="index.ts"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Dependencies */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Dependencies
                </label>
                <input
                  value={editDependencies}
                  onChange={(e) => setEditDependencies(e.target.value)}
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  placeholder="comma-separated: axios, cheerio"
                />
              </div>

              {/* Plans */}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Available Plans
                </label>
                <div className="flex items-center gap-3">
                  {PLAN_OPTIONS.map((plan) => (
                    <label key={plan} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={editPlans.has(plan)}
                        onChange={() => toggleEditPlan(plan)}
                        className="accent-primary"
                      />
                      <span className="font-mono text-xs text-foreground capitalize">
                        {plan}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={onToggle}
                  className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
