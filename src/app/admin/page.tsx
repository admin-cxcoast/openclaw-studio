"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatsCard } from "@/features/admin/components/StatsCard";
import { Building2, Server, Users, Blocks } from "lucide-react";

export default function AdminOverviewPage() {
  const orgs = useQuery(api.organizations.list);
  const users = useQuery(api.users.list);
  const vps = useQuery(api.vpsInstances.list);
  const providers = useQuery(api.providers.list);

  return (
    <div className="space-y-6">
      <h1 className="console-title text-2xl text-foreground">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Organizations"
          value={orgs?.length ?? "..."}
          icon={Building2}
        />
        <StatsCard
          label="Users"
          value={users?.length ?? "..."}
          icon={Users}
        />
        <StatsCard
          label="VPS Instances"
          value={vps?.length ?? "..."}
          icon={Server}
        />
        <StatsCard
          label="Providers"
          value={providers?.length ?? "..."}
          icon={Blocks}
        />
      </div>
    </div>
  );
}
