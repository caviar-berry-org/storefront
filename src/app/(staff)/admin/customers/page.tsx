import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerDirectory } from "@/components/staff/customers/customer-directory";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffHelp } from "@/components/staff/staff-help";
import { StaffExport } from "@/components/staff/staff-export";
import styles from "@/components/staff/staff.module.css";
import { kyivDate } from "@/domain/inquiry";
import { staffCopy } from "@/i18n/staff-uk";
import { readCustomerPage } from "@/lib/server/customer-directory";
import { requireStaffSession } from "@/lib/server/staff-session";

export const metadata: Metadata = {
  title: `${staffCopy.sections.customers} | ${staffCopy.brand}`,
};

export default async function CustomersPage() {
  await requireStaffSession();
  const copy = staffCopy.customerDirectory;

  return (
    <>
      <StaffHeading
        title={staffCopy.sections.customers}
        tools={
          <div className={styles.recordTools}>
            <StaffExport
              href="/admin/customers/export"
              filename="customers.xlsx"
              label={copy.excel}
              title={copy.exportExcel}
              failure={copy.exportFailed}
            />
            <StaffHelp label={copy.help} text={copy.helpText} />
          </div>
        }
      />
      <Suspense fallback={<p role="status">{staffCopy.loading}</p>}>
        <CustomerResults />
      </Suspense>
    </>
  );
}

async function CustomerResults() {
  const page = await readCustomerPage().catch(() => null);
  return <CustomerDirectory initialPage={page} today={kyivDate()} />;
}
