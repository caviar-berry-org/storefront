import { AdminLink } from "./admin-link";
import { StaffIcon } from "./staff-icon";
import styles from "./staff.module.css";

export function StaffBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <AdminLink
      href={href}
      aria-label={label}
      title={label}
      className={styles.recordBack}
    >
      <StaffIcon name="arrow" />
    </AdminLink>
  );
}
