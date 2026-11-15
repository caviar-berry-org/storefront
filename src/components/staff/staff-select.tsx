import type { ComponentProps, ReactNode } from "react";
import { StaffIcon } from "./staff-icon";
import styles from "./staff-select.module.css";

export function StaffSelect({
  label,
  ...props
}: ComponentProps<"select"> & { label: ReactNode }) {
  return (
    <label className={styles.label}>
      <span>{label}</span>
      <span className={styles.control}>
        <select {...props} />
        <StaffIcon name="chevron" />
      </span>
    </label>
  );
}
