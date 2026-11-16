import { Suspense } from "react";
import { DashboardMetrics } from "@/components/staff/dashboard-metrics";
import { OrdersTrendPanel } from "@/components/staff/orders-trend";
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
      // The panel counts nothing until a staff member asks, and keeps every
      // window it has already fetched, so switching back costs no request.
      trend={<OrdersTrendPanel />}
    />
  );
}
