"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OrganizationsPage() {
  const orgs = useQuery(api.organizations.list);
  const createOrg = useMutation(api.organizations.create);
  const updateOrg = useMutation(api.organizations.update);
  const removeOrg = useMutation(api.organizations.remove);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<"free" | "starter" | "pro" | "enterprise">("free");
  const [deleteTarget, setDeleteTarget] = useState<Id<"organizations"> | null>(null);
  const [editId, setEditId] = useState<Id<"organizations"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState<"free" | "starter" | "pro" | "enterprise">("free");
  const [editStatus, setEditStatus] = useState<"active" | "suspended" | "archived">("active");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrg({ name, slug: slugify(name), plan });
    setName("");
    setPlan("free");
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editId) return;
    await updateOrg({ id: editId, name: editName, plan: editPlan, status: editStatus });
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">
          Organizations
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={14} /> New Organization
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel flex items-end gap-3 rounded-lg p-4"
        >
          <div className="flex flex-1 flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              placeholder="Acme Corp"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Slug
            </label>
            <input
              readOnly
              value={slugify(name)}
              className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Plan
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
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

      <div className="glass-panel overflow-hidden rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Slug
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Plan
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {orgs === undefined ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  No organizations yet.
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr
                  key={org._id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                    {editId === org._id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded border border-border bg-input px-2 py-1 text-xs"
                      />
                    ) : (
                      org.name
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {org.slug}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === org._id ? (
                      <select
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value as typeof editPlan)}
                        className="rounded border border-border bg-input px-2 py-1 font-mono text-xs"
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    ) : (
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] capitalize text-primary">
                        {org.plan}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === org._id ? (
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
                        className="rounded border border-border bg-input px-2 py-1 font-mono text-xs"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="archived">Archived</option>
                      </select>
                    ) : (
                      <StatusBadge status={org.status} />
                    )}
                  </td>
                  <td className="flex items-center gap-1 px-4 py-2.5">
                    {editId === org._id ? (
                      <>
                        <button
                          onClick={handleUpdate}
                          className="rounded bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground hover:bg-primary/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditId(org._id);
                            setEditName(org.name);
                            setEditPlan(org.plan);
                            setEditStatus(org.status);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(org._id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Organization"
        message="This action cannot be undone. All associated data will be removed."
        onConfirm={async () => {
          if (deleteTarget) await removeOrg({ id: deleteTarget });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-green-500/10 text-green-600 dark:text-green-400"
      : status === "suspended"
        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-mono text-[10px] capitalize ${color}`}
    >
      {status}
    </span>
  );
}
