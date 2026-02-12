"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LogOut } from "lucide-react";

export function AdminHeader() {
  const { signOut } = useAuthActions();
  const current = useQuery(api.users.currentUser);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <h2 className="console-title text-base text-foreground">
        OpenClaw Studio
      </h2>
      <div className="flex items-center gap-4">
        {current?.profile && (
          <span className="font-mono text-xs text-muted-foreground">
            {current.user?.email as string ?? "Admin"}
          </span>
        )}
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut size={14} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </header>
  );
}
