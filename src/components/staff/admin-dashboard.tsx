import type { ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { ReportCard } from "./report-card";
import { StaffHelp } from "./staff-help";
import { StaffHeading } from "./staff-heading";
import styles from "./staff.module.css";

const copy = staffCopy.dashboard;
/**
 * Orders and new orders are no longer placeholders — the trend chart above
 * carries both, over a time axis these cards never had. What is left is the
 * traffic reporting still to be built.
 */
const reports = [
  { title: copy.visits, icon: "visits" },
  { title: copy.campaigns, icon: "utm" },
  { title: copy.regions, icon: "regions" },
  { title: copy.countries, icon: "countries" },
] as const;

export function AdminDashboard({
  metrics,
  trend,
}: {
  metrics: ReactNode;
  trend: ReactNode;
}) {
  return (
    <>
      <StaffHeading
        title={staffCopy.sections.overview}
        tools={<StaffHelp label={copy.help} text={copy.helpText} />}
      />
      {metrics}
      <div className={styles.trendRow}>{trend}</div>
      <div className={styles.reportGrid}>
        {reports.map((report) => (
          <ReportCard key={report.icon} {...report} />
        ))}
      </div>
    </>
  );
}
