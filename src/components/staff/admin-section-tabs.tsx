import { StaffIcon } from "./staff-icon";
import { AdminLink } from "./admin-link";
import { staffCopy } from "@/i18n/staff-uk";
import { adminPath, type AdminSection } from "./navigation";
import styles from "./staff.module.css";

export function AdminSectionTabs({
  section,
  selected,
}: {
  section: AdminSection;
  selected?: string;
}) {
  if (!section.children) return null;
  return (
    <nav className={styles.tabs} aria-label={staffCopy.sectionNavigation}>
      {section.children.map((item) => (
        <AdminLink
          key={item.slug}
          href={adminPath(section.slug + "/" + item.slug)}
          aria-current={selected === item.slug ? "page" : undefined}
        >
          {item.icon && <StaffIcon name={item.icon} />}
          {staffCopy.sections[item.name]}
        </AdminLink>
      ))}
    </nav>
  );
}
