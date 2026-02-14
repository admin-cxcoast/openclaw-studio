"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type OrgRole = "owner" | "admin" | "member" | "viewer";
type PanelTab = "entries" | "proposals";

type KnowledgePanelProps = {
  orgId: string;
  orgRole: OrgRole;
};

const isAdmin = (role: OrgRole) => role === "owner" || role === "admin";
const canWrite = (role: OrgRole) => role !== "viewer";

export function KnowledgePanel({ orgId, orgRole }: KnowledgePanelProps) {
  const typedOrgId = orgId as Id<"organizations">;
  const entries = useQuery(api.knowledge.list, { orgId: typedOrgId });
  const pendingProposals = useQuery(
    api.knowledgeProposals.listPending,
    isAdmin(orgRole) ? { orgId: typedOrgId } : "skip",
  );

  const createEntry = useMutation(api.knowledge.create);
  const updateEntry = useMutation(api.knowledge.update);
  const removeEntry = useMutation(api.knowledge.remove);
  const approveProposal = useMutation(api.knowledgeProposals.approve);
  const rejectProposal = useMutation(api.knowledgeProposals.reject);

  const [panelTab, setPanelTab] = useState<PanelTab>("entries");
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form state
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  // Edit form state
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editKey, setEditKey] = useState("");

  const filteredEntries = entries?.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.key.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleCreate = async () => {
    if (!newKey.trim() || !newContent.trim()) return;
    try {
      await createEntry({
        orgId: typedOrgId,
        key: newKey.trim(),
        content: newContent.trim(),
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setNewKey("");
      setNewContent("");
      setNewTags("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create knowledge entry:", err);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateEntry({
        id: id as Id<"knowledge">,
        key: editKey.trim() || undefined,
        content: editContent.trim() || undefined,
        tags: editTags
          ? editTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      });
      setExpandedId(null);
    } catch (err) {
      console.error("Failed to update knowledge entry:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeEntry({ id: id as Id<"knowledge"> });
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete knowledge entry:", err);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveProposal({ id: id as Id<"knowledgeProposals"> });
    } catch (err) {
      console.error("Failed to approve proposal:", err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectProposal({ id: id as Id<"knowledgeProposals"> });
    } catch (err) {
      console.error("Failed to reject proposal:", err);
    }
  };

  const openEdit = (entry: NonNullable<typeof entries>[number]) => {
    setExpandedId(entry._id);
    setEditKey(entry.key);
    setEditContent(entry.content);
    setEditTags(entry.tags.join(", "));
  };

  const pendingCount = pendingProposals?.length ?? 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="console-title text-lg text-foreground">Knowledge</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            {entries?.length ?? "..."} entries
          </p>
        </div>
        {canWrite(orgRole) && (
          <button
            type="button"
            className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? "Cancel" : "Add Entry"}
          </button>
        )}
      </div>

      {/* Tab row */}
      {isAdmin(orgRole) && (
        <div className="flex gap-2 border-b border-border/70 px-4 py-2">
          {(["entries", "proposals"] as const).map((tab) => {
            const active = panelTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
                  active
                    ? "border-border bg-surface-2 text-foreground"
                    : "border-border/80 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2"
                }`}
                onClick={() => setPanelTab(tab)}
              >
                {tab === "entries" ? "Entries" : `Proposals${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border-b border-border/70 bg-muted/10 px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Key
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. api-conventions"
                className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="e.g. coding, style"
                className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Content
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              placeholder="Knowledge content..."
              className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-surface-2"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
              disabled={!newKey.trim() || !newContent.trim()}
              onClick={() => void handleCreate()}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-auto">
        {panelTab === "entries" ? (
          <div className="flex flex-col">
            {/* Search */}
            <div className="px-4 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by key, content, or tag..."
                className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Entry list */}
            {!filteredEntries ? (
              <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                Loading...
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                {searchQuery ? "No entries match your search." : "No knowledge entries yet."}
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isExpanded = expandedId === entry._id;
                return (
                  <div key={entry._id} className="border-b border-border/50">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-muted/10"
                      onClick={() => (isExpanded ? setExpandedId(null) : openEdit(entry))}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-xs font-semibold text-foreground">
                            {entry.key}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] ${
                              entry.source === "human"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                            }`}
                          >
                            {entry.source}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {entry.content.slice(0, 120)}
                          {entry.content.length > 120 ? "..." : ""}
                        </p>
                        {entry.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Expanded edit form */}
                    {isExpanded && (
                      <div className="bg-muted/10 px-4 py-3">
                        <div className="mb-3">
                          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            Key
                          </label>
                          <input
                            type="text"
                            value={editKey}
                            onChange={(e) => setEditKey(e.target.value)}
                            className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            Content
                          </label>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={6}
                            className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            Tags (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
                          />
                        </div>
                        <div className="flex justify-between">
                          <div>
                            {isAdmin(orgRole) && (
                              <button
                                type="button"
                                className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/20"
                                onClick={() => void handleDelete(entry._id)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-surface-2"
                              onClick={() => setExpandedId(null)}
                            >
                              Cancel
                            </button>
                            {canWrite(orgRole) && (
                              <button
                                type="button"
                                className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105"
                                onClick={() => void handleUpdate(entry._id)}
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Proposals tab */
          <div className="flex flex-col">
            {!pendingProposals ? (
              <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                Loading...
              </div>
            ) : pendingProposals.length === 0 ? (
              <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                No pending proposals.
              </div>
            ) : (
              pendingProposals.map((proposal) => (
                <div key={proposal._id} className="border-b border-border/50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {proposal.key}
                        </span>
                        <span className="inline-block rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] text-amber-600 dark:text-amber-400">
                          pending
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        From agent: {proposal.agentId}
                      </p>
                      <div className="mt-2 rounded-md border border-border/50 bg-input/50 px-3 py-2 font-mono text-xs text-foreground">
                        {proposal.content.slice(0, 300)}
                        {proposal.content.length > 300 ? "..." : ""}
                      </div>
                      {proposal.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {proposal.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/20"
                      onClick={() => void handleReject(proposal._id)}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105"
                      onClick={() => void handleApprove(proposal._id)}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
