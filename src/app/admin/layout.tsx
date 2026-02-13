"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminHeader } from "@/features/admin/components/AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const current = useQuery(api.users.currentUser);

  useEffect(() => {
    if (current === null) {
      router.replace("/signin");
    }
  }, [current, router]);

  if (current === undefined || current === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">
          Loading...
        </span>
      </div>
    );
  }

  if (!current.profile || current.profile.role !== "superAdmin") {
    router.replace("/");
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-mono text-xs text-muted-foreground">
          Redirecting...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
