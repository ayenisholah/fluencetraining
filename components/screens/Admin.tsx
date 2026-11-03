"use client";

import { useQuery } from "convex/react";
import { useRowAction } from "@/components/useRowAction";
import { EmptyState, PageHeader, ShieldIcon, Spinner } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { AdminStats } from "./admin/AdminStats";
import { AllLoans } from "./admin/AllLoans";
import { AutomationHealth } from "./admin/AutomationHealth";
import { ListingsModeration } from "./admin/ListingsModeration";
import { Members } from "./admin/Members";

/**
 * Admin dashboard. The role check here only decides what to render: every
 * admin query and mutation re-checks the role on the server (requireAdmin),
 * and none of them is even subscribed until the role is confirmed.
 */
export function AdminScreen() {
  const me = useQuery(api.users.me);
  if (me === undefined) return <Spinner />;
  if (me?.role !== "admin") return <EmptyState icon={<ShieldIcon />} title="Admins only" />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const actions = useRowAction();
  return (
    <>
      <PageHeader title="Admin" description="Moderation and automation health." />
      <div className="space-y-6">
        <AdminStats />
        <AutomationHealth actions={actions} />
        <AllLoans />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ListingsModeration />
          <Members actions={actions} />
        </div>
      </div>
    </>
  );
}
