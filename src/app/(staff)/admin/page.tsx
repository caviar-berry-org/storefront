import { Suspense } from "react";
import { DashboardMetrics } from "@/components/staff/dashboard-metrics";
import { StaffBusy } from "@/components/staff/staff-feedback";
import { AdminDashboard } from "@/components/staff/admin-dashboard";
import { staffCopy } from "@/i18n/staff-uk";
import { requireStaffSession } from "@/lib/server/staff-session";

export const metadata = {
  title: `${staffCopy.sections.overview} | ${staffCopy.brand}`,
};

export default async function AdminPage() {
  await requireStaffSession();
  return (
    <AdminDashboard
      metrics={
        <Suspense fallback={<StaffBusy />}>
          <DashboardMetrics />
        </Suspense>
      }
    />
  );
}
