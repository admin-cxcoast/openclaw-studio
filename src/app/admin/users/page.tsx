"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function UsersPage() {
  const users = useQuery(api.users.list);
  const updateRole = useMutation(api.users.updateRole);

  const handleRoleChange = async (
    userId: Id<"users">,
    role: "superAdmin" | "orgAdmin" | "member",
  ) => {
    await updateRole({ userId, role });
  };

  return (
    <div className="space-y-6">
      <h1 className="console-title text-2xl text-foreground">Users</h1>

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
                Last Login
              </th>
            </tr>
          </thead>
          <tbody>
            {users === undefined ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center font-mono text-xs text-muted-foreground"
                >
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u._id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                    {(u.email as string) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                    {u.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleRoleChange(
                          u.userId,
                          e.target.value as "superAdmin" | "orgAdmin" | "member",
                        )
                      }
                      className="rounded-md border border-border bg-input px-2 py-1 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="superAdmin">Super Admin</option>
                      <option value="orgAdmin">Org Admin</option>
                      <option value="member">Member</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
