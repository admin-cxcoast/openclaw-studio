"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Upload, Download, FileText, Loader2 } from "lucide-react";
import {
  extractText,
  isAcceptedType,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
} from "../lib/extractText";

type OrgRole = "owner" | "admin" | "member" | "viewer";
type DocType = "general" | "spec" | "runbook" | "reference";

type DocumentsPanelProps = {
  orgId: string;
  orgRole: OrgRole;
};

const DOC_TYPES: Array<{ value: DocType; label: string }> = [
  { value: "general", label: "General" },
  { value: "spec", label: "Spec" },
  { value: "runbook", label: "Runbook" },
  { value: "reference", label: "Reference" },
];

const docTypeColors: Record<DocType, string> = {
  general: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  spec: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  runbook: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  reference: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const isAdmin = (role: OrgRole) => role === "owner" || role === "admin";
const canWrite = (role: OrgRole) => role !== "viewer";

function DownloadButton({ storageId, fileName }: { storageId: string; fileName: string }) {
  const url = useQuery(api.documents.getFileUrl, {
    storageId: storageId as Id<"_storage">,
  });

  if (!url) return null;

  return (
    <a
      href={url}
      download={fileName}
      className="flex items-center gap-1 rounded-md border border-border bg-surface-1 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-surface-2"
    >
      <Download className="h-3 w-3" />
      Download
    </a>
  );
}

export function DocumentsPanel({ orgId, orgRole }: DocumentsPanelProps) {
  const typedOrgId = orgId as Id<"organizations">;
  const docs = useQuery(api.documents.list, { orgId: typedOrgId });

  const createDoc = useMutation(api.documents.create);
  const updateDoc = useMutation(api.documents.update);
  const removeDoc = useMutation(api.documents.remove);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);

  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDocType, setNewDocType] = useState<DocType>("general");
  const [newTags, setNewTags] = useState("");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "extracting" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editDocType, setEditDocType] = useState<DocType>("general");
  const [editTags, setEditTags] = useState("");

  const filteredDocs = docs?.filter((d) => {
    if (typeFilter !== "all" && d.docType !== typeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      d.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    if (!isAcceptedType(file)) {
      setUploadError("Unsupported file type. Use .txt, .md, .csv, or .pdf");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024} MB`);
      return;
    }
    setSelectedFile(file);
    if (!newTitle.trim()) {
      setNewTitle(file.name.replace(/\.[^.]+$/, ""));
    }
    try {
      setUploadStatus("extracting");
      const text = await extractText(file);
      setNewContent(text);
      setUploadStatus("idle");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Text extraction failed");
      setUploadStatus("error");
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      let storageId: Id<"_storage"> | undefined;

      if (selectedFile) {
        setUploadStatus("uploading");
        const uploadUrl = await generateUploadUrl({ orgId: typedOrgId });
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
          body: selectedFile,
        });
        if (!result.ok) throw new Error("File upload failed");
        const json = await result.json();
        storageId = json.storageId as Id<"_storage">;
      }

      await createDoc({
        orgId: typedOrgId,
        title: newTitle.trim(),
        content: newContent.trim(),
        docType: newDocType,
        tags: newTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(storageId && { storageId }),
        ...(selectedFile && { fileName: selectedFile.name }),
        ...(selectedFile && { fileSize: selectedFile.size }),
        ...(selectedFile && {
          mimeType: selectedFile.type || "application/octet-stream",
        }),
      });
      setNewTitle("");
      setNewContent("");
      setNewDocType("general");
      setNewTags("");
      setSelectedFile(null);
      setUploadStatus("idle");
      setUploadError(null);
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create document:", err);
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateDoc({
        id: id as Id<"documents">,
        title: editTitle.trim() || undefined,
        content: editContent.trim() || undefined,
        docType: editDocType,
        tags: editTags
          ? editTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      });
      setExpandedId(null);
    } catch (err) {
      console.error("Failed to update document:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeDoc({ id: id as Id<"documents"> });
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const openEdit = (doc: NonNullable<typeof docs>[number]) => {
    setExpandedId(doc._id);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditDocType(doc.docType);
    setEditTags(doc.tags.join(", "));
  };

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewTitle("");
    setNewContent("");
    setNewDocType("general");
    setNewTags("");
    setSelectedFile(null);
    setUploadStatus("idle");
    setUploadError(null);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="console-title text-lg text-foreground">Documents</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            {docs?.length ?? "..."} documents
          </p>
        </div>
        {canWrite(orgRole) && (
          <button
            type="button"
            className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105"
            onClick={() => (showCreate ? resetCreateForm() : setShowCreate(true))}
          >
            {showCreate ? "Cancel" : "New Document"}
          </button>
        )}
      </div>

      {/* Type filter row */}
      <div className="flex gap-2 border-b border-border/70 px-4 py-2">
        <button
          type="button"
          className={`rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
            typeFilter === "all"
              ? "border-border bg-surface-2 text-foreground"
              : "border-border/80 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2"
          }`}
          onClick={() => setTypeFilter("all")}
        >
          All
        </button>
        {DOC_TYPES.map((dt) => (
          <button
            key={dt.value}
            type="button"
            className={`rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
              typeFilter === dt.value
                ? "border-border bg-surface-2 text-foreground"
                : "border-border/80 bg-surface-1 text-muted-foreground hover:border-border hover:bg-surface-2"
            }`}
            onClick={() => setTypeFilter(dt.value)}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border-b border-border/70 bg-muted/10 px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title"
                className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Type
              </label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as DocType)}
                className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="e.g. deployment, api"
              className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          {/* File Upload */}
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Upload File (optional)
            </label>
            <label
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-input px-3 py-4 font-mono text-sm text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/20"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files[0];
                if (file) void handleFileSelect(file);
              }}
            >
              <input
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelect(file);
                }}
              />
              {uploadStatus === "extracting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting text...</span>
                </>
              ) : selectedFile ? (
                <>
                  <FileText className="h-4 w-4" />
                  <span>
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedFile(null);
                      setNewContent("");
                      setUploadError(null);
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Drop a file or click to browse (.txt, .md, .csv, .pdf)</span>
                </>
              )}
            </label>
            {uploadError && (
              <p className="mt-1 font-mono text-[10px] text-destructive">{uploadError}</p>
            )}
          </div>
          <div className="mt-3">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Content{selectedFile ? " (extracted from file)" : ""}
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={6}
              placeholder="Document content..."
              className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-surface-2"
              onClick={resetCreateForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-transparent bg-primary px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
              disabled={
                !newTitle.trim() ||
                !newContent.trim() ||
                uploadStatus === "uploading" ||
                uploadStatus === "extracting"
              }
              onClick={() => void handleCreate()}
            >
              {uploadStatus === "uploading" ? "Uploading..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* Search */}
        <div className="px-4 py-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, content, or tag..."
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Document list */}
        {!filteredDocs ? (
          <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            Loading...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
            {searchQuery || typeFilter !== "all"
              ? "No documents match your filters."
              : "No documents yet."}
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isExpanded = expandedId === doc._id;
            return (
              <div key={doc._id} className="border-b border-border/50">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-muted/10"
                  onClick={() => (isExpanded ? setExpandedId(null) : openEdit(doc))}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-foreground">
                        {doc.title}
                      </span>
                      {doc.storageId && (
                        <span title="Has attached file">
                          <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 font-mono text-[9px] ${docTypeColors[doc.docType]}`}
                      >
                        {doc.docType}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {doc.content.slice(0, 120)}
                      {doc.content.length > 120 ? "..." : ""}
                    </p>
                    {doc.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {doc.tags.map((tag) => (
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
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          Type
                        </label>
                        <select
                          value={editDocType}
                          onChange={(e) => setEditDocType(e.target.value as DocType)}
                          className="w-full rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground"
                        >
                          {DOC_TYPES.map((dt) => (
                            <option key={dt.value} value={dt.value}>
                              {dt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Content
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={8}
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
                    {/* File attachment info + download */}
                    {doc.storageId && doc.fileName && (
                      <div className="mb-3 flex items-center gap-2 rounded-md border border-border/50 bg-surface-1 px-3 py-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                          {doc.fileName}
                          {doc.fileSize != null &&
                            ` (${(doc.fileSize / 1024).toFixed(0)} KB)`}
                        </span>
                        <DownloadButton
                          storageId={doc.storageId}
                          fileName={doc.fileName}
                        />
                      </div>
                    )}
                    <div className="flex justify-between">
                      <div>
                        {isAdmin(orgRole) && (
                          <button
                            type="button"
                            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/20"
                            onClick={() => void handleDelete(doc._id)}
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
                            onClick={() => void handleUpdate(doc._id)}
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
    </div>
  );
}
