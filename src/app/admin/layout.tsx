"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminHeader } from "@/features/admin/components/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = useQuery(api.users.currentUser);

  useEffect(() => {
    if (current === null) {
      window.location.href = "/signin";
    }
  }, [current]);

  if (current === undefined || current === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  if (!current.profile || current.profile.role !== "superAdmin") {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="glass-panel w-full max-w-sm rounded-xl p-6 text-center">
          <h1 className="console-title mb-2 text-2xl text-foreground">
            Access Denied
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            Super admin privileges required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
