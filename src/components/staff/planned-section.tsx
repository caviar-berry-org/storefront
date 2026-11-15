import { AdminSectionTabs } from "./admin-section-tabs";
import { staffCopy } from "@/i18n/staff-uk";
import { type AdminSection } from "./navigation";
import { StaffHeading } from "./staff-heading";
import { PlannedState } from "./planned-state";
import styles from "./staff.module.css";

export function PlannedSection({
  section,
  child,
}: {
  section: AdminSection;
  child?: NonNullable<AdminSection["children"]>[number];
}) {
  return (
    <>
      <StaffHeading title={staffCopy.sections[section.name]} />
      <AdminSectionTabs section={section} selected={child?.slug} />
      <div className={styles.modulePlaceholder}>
        <PlannedState label={staffCopy.planned} />
      </div>
    </>
  );
}
