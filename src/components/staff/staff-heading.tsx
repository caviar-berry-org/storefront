import type { ReactNode } from "react";
import { StaffBackLink } from "./staff-back-link";
import styles from "./staff.module.css";

export function StaffHeading({
  title,
  back,
  action,
  badges,
  tools,
  level = "h1",
}: {
  title: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  badges?: ReactNode;
  tools?: ReactNode;
  level?: "h1" | "h2";
}) {
  const Heading = level;
  return (
    <header className={styles.pageHeader} data-level={level}>
      <div className={styles.titleActions}>
        {back && <StaffBackLink {...back} />}
        {badges ? (
          <div className={styles.titleWithBadges}>
            <Heading>{title}</Heading>
            {badges}
          </div>
        ) : (
          <Heading>{title}</Heading>
        )}
        {action}
      </div>
      {tools}
    </header>
  );
}
