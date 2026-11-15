import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDirectory } from "@/components/staff/orders/order-directory";
import { OrderTally } from "@/components/staff/orders/order-tally";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffHelp } from "@/components/staff/staff-help";
import { StaffExport } from "@/components/staff/staff-export";
import styles from "@/components/staff/staff.module.css";
import { defaultOrderFilters } from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { readOrders } from "@/lib/server/orders/queries";
import { orderFailure } from "@/lib/server/orders/feedback";
import { StaffBusy } from "@/components/staff/staff-feedback";
import { requireStaffSession } from "@/lib/server/staff-session";

export const metadata: Metadata = {
  title: `${staffCopy.sections.orders} | ${staffCopy.brand}`,
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string }>;
}) {
  await requireStaffSession();
  const active = (await searchParams).queue === "active";

  return (
    <>
      <StaffHeading
        title={staffCopy.sections.orders}
        tools={
          <div className={styles.recordTools}>
            <StaffExport
              href="/admin/orders/export"
              filename="orders.xlsx"
              label={copy.excel}
              title={copy.exportExcel}
              failure={copy.exportFailed}
            />
            <StaffHelp label={copy.help} text={copy.helpText} />
          </div>
        }
      />
      {/* Its own boundary: a slow count must not hold back the list itself. */}
      <Suspense fallback={null}>
        <OrderTally />
      </Suspense>
      <Suspense fallback={<StaffBusy />}>
        <Results key={String(active)} active={active} />
      </Suspense>
    </>
  );
}

async function Results({ active }: { active: boolean }) {
  const filters = active
    ? { ...defaultOrderFilters, status: "active" as const }
    : defaultOrderFilters;
  const initial = await readOrders(filters, null).catch((error: unknown) => ({
    error: orderFailure("list", error),
  }));
  return <OrderDirectory initial={initial} initialFilters={filters} />;
}
