import type { ReactNode } from "react";
import { StaffHeading } from "./staff-heading";
import styles from "./staff.module.css";

export function StaffRecord({
  title,
  back,
  badges,
  action,
  children,
}: {
  title: string;
  back: { href: string; label: string };
  badges?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.record}>
      <StaffHeading title={title} back={back} badges={badges} tools={action} />
      {children}
    </div>
  );
}
