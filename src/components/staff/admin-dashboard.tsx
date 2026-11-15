import type { ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { ReportCard } from "./report-card";
import { StaffHelp } from "./staff-help";
import { StaffHeading } from "./staff-heading";
import styles from "./staff.module.css";

const copy = staffCopy.dashboard;
const reports = [
  { title: copy.orders, icon: "overview" },
  { title: copy.newOrders, icon: "orders" },
  { title: copy.visits, icon: "visits" },
  { title: copy.campaigns, icon: "utm" },
  { title: copy.regions, icon: "regions" },
  { title: copy.countries, icon: "countries" },
] as const;

export function AdminDashboard({ metrics }: { metrics: ReactNode }) {
  return (
    <>
      <StaffHeading
        title={staffCopy.sections.overview}
        tools={<StaffHelp label={copy.help} text={copy.helpText} />}
      />
      {metrics}
      <div className={styles.reportGrid}>
        {reports.map((report) => (
          <ReportCard key={report.icon} {...report} />
        ))}
      </div>
    </>
  );
}
