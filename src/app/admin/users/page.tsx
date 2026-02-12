"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { Plus, X, UserPlus, Pencil } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";

type OrgRole = "owner" | "admin" | "member" | "viewer";
type SystemRole = "superAdmin" | "orgAdmin" | "member";

export default function UsersPage() {
  const users = useQuery(api.users.list);
  const orgs = useQuery(api.organizations.list);
  const currentUser = useQuery(api.users.currentUser);
  const updateRole = useMutation(api.users.updateRole);
  const updateProfile = useMutation(api.users.updateProfile);
  const createUser = useAction(api.users.createUser);
  const addToOrg = useMutation(api.orgMembers.add);
  const updateOrgRole = useMutation(api.orgMembers.updateRole);
  const removeFromOrg = useMutation(api.orgMembers.remove);

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<SystemRole>("member");
  const [newOrgId, setNewOrgId] = useState<string>("");
  const [newOrgRole, setNewOrgRole] = useState<OrgRole>("member");

  // Edit user
  const [editUserId, setEditUserId] = useState<Id<"users"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Assign to org (existing user)
  const [assignTarget, setAssignTarget] = useState<Id<"users"> | null>(null);
  const [assignOrgId, setAssignOrgId] = useState<string>("");
  const [assignOrgRole, setAssignOrgRole] = useState<OrgRole>("member");
  const [assigning, setAssigning] = useState(false);

  // Remove from org
  const [removeTarget, setRemoveTarget] = useState<{
    membershipId: Id<"orgMembers">;
    userName: string;
    orgName: string;
  } | null>(null);

  // Role change error
  const [roleError, setRoleError] = useState<string | null>(null);

  const isSelf = (userId: Id<"users">) =>
    currentUser?.user?._id === userId;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createUser({
        email,
        password,
        name: newName || undefined,
        role: newRole,
        orgId: newOrgId ? (newOrgId as Id<"organizations">) : undefined,
        orgRole: newOrgId ? newOrgRole : undefined,
      });
      setEmail("");
      setPassword("");
      setNewName("");
      setNewRole("member");
      setNewOrgId("");
      setNewOrgRole("member");
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleEditSave = async (userId: Id<"users">) => {
    setEditError(null);
    try {
      await updateProfile({ userId, name: editName || undefined });
      setEditUserId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleRoleChange = async (userId: Id<"users">, role: SystemRole) => {
    setRoleError(null);
    try {
      await updateRole({ userId, role });
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "Failed to change role");
    }
  };

  const handleOrgRoleChange = async (membershipId: Id<"orgMembers">, role: OrgRole) => {
    try {
      await updateOrgRole({ id: membershipId, role });
    } catch {
      // shown by Convex
    }
  };

  const handleAssignToOrg = async () => {
    if (!assignTarget || !assignOrgId) return;
    setAssigning(true);
    try {
      await addToOrg({
        userId: assignTarget,
        orgId: assignOrgId as Id<"organizations">,
        role: assignOrgRole,
      });
      setAssignTarget(null);
      setAssignOrgId("");
      setAssignOrgRole("member");
    } catch {
      // shown by Convex
    } finally {
      setAssigning(false);
    }
  };

  // Count super admins for UI hints
  const superAdminCount = users?.filter((u) => u.role === "superAdmin").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="console-title text-2xl text-foreground">Users</h1>
        <button
          onClick={() => {
            setShowCreate(!showCreate);
            setCreateError(null);
          }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus size={14} /> Create User
        </button>
      </div>

      {/* Role change error banner */}
      {roleError && (
        <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
          <p className="font-mono text-xs text-destructive">{roleError}</p>
          <button
            onClick={() => setRoleError(null)}
            className="ml-2 text-destructive hover:text-destructive/80"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Create User Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="glass-panel space-y-3 rounded-lg p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Email *
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="user@example.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Password *
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="John Doe"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                System Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as SystemRole)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="member">Member</option>
                <option value="orgAdmin">Org Admin</option>
                <option value="superAdmin">Super Admin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Assign to Organization
              </label>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">None</option>
                {orgs?.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            {newOrgId && (
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Org Role
                </label>
                <select
                  value={newOrgRole}
                  onChange={(e) => setNewOrgRole(e.target.value as OrgRole)}
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            )}
          </div>

          {createError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {createError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-primary px-4 py-1.5 font-mono text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create User"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="glass-panel overflow-hidden rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Organizations
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Created
              </th>
              <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users === undefined ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                >
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isEditing = editUserId === u.userId;
                const self = isSelf(u.userId);
                const isOnlySuperAdmin =
                  u.role === "superAdmin" && superAdminCount <= 1;

                return (
                  <tr
                    key={u._id}
                    className="border-b border-border/50 last:border-0"
                  >
                    {/* Email */}
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                      <div className="flex items-center gap-1.5">
                        {(u.email as string) ?? "—"}
                        {self && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                            you
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name (editable) */}
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-32 rounded border border-border bg-input px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSave(u.userId);
                              if (e.key === "Escape") setEditUserId(null);
                            }}
                          />
                          <button
                            onClick={() => handleEditSave(u.userId)}
                            className="rounded bg-primary px-2 py-1 font-mono text-[10px] text-primary-foreground hover:bg-primary/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditUserId(null)}
                            className="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        u.name ?? "—"
                      )}
                      {isEditing && editError && (
                        <p className="mt-1 text-[10px] text-destructive">{editError}</p>
                      )}
                    </td>

                    {/* System Role */}
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(
                            u.userId,
                            e.target.value as SystemRole,
                          )
                        }
                        disabled={self || isOnlySuperAdmin}
                        title={
                          self
                            ? "Cannot change your own role"
                            : isOnlySuperAdmin
                              ? "Cannot demote the last Super Admin"
                              : undefined
                        }
                        className="rounded-md border border-border bg-input px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="superAdmin">Super Admin</option>
                        <option value="orgAdmin">Org Admin</option>
                        <option value="member">Member</option>
                      </select>
                    </td>

                    {/* Organizations with inline org-role editing */}
                    <td className="px-4 py-2.5">
                      {u.memberships && u.memberships.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.memberships.map((m) => (
                            <span
                              key={m.membershipId}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
                            >
                              {m.orgName}
                              <select
                                value={m.orgRole}
                                onChange={(e) =>
                                  handleOrgRoleChange(
                                    m.membershipId,
                                    e.target.value as OrgRole,
                                  )
                                }
                                className="border-none bg-transparent font-mono text-[10px] text-muted-foreground outline-none"
                              >
                                <option value="viewer">viewer</option>
                                <option value="member">member</option>
                                <option value="admin">admin</option>
                                <option value="owner">owner</option>
                              </select>
                              <button
                                onClick={() =>
                                  setRemoveTarget({
                                    membershipId: m.membershipId,
                                    userName:
                                      u.name ?? (u.email as string) ?? "User",
                                    orgName: m.orgName,
                                  })
                                }
                                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>

                    {/* Created date */}
                    <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString()
                        : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditUserId(u.userId);
                            setEditName(u.name ?? "");
                            setEditError(null);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit Name"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setAssignTarget(u.userId);
                            setAssignOrgId("");
                            setAssignOrgRole("member");
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Assign to Organization"
                        >
                          <UserPlus size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Assign to Org Dialog */}
      {assignTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass-panel w-full max-w-sm rounded-xl p-6">
            <h3 className="console-title mb-4 text-lg text-foreground">
              Assign to Organization
            </h3>
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Organization
                </label>
                <select
                  value={assignOrgId}
                  onChange={(e) => setAssignOrgId(e.target.value)}
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select organization...</option>
                  {orgs?.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Role
                </label>
                <select
                  value={assignOrgRole}
                  onChange={(e) =>
                    setAssignOrgRole(e.target.value as OrgRole)
                  }
                  className="rounded-md border border-border bg-input px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setAssignTarget(null)}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignToOrg}
                disabled={!assignOrgId || assigning}
                className="rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Org Confirmation */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove from Organization"
        message={
          removeTarget
            ? `Remove ${removeTarget.userName} from ${removeTarget.orgName}?`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={async () => {
          if (removeTarget) {
            await removeFromOrg({ id: removeTarget.membershipId });
          }
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
