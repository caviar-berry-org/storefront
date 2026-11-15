import type { ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import styles from "./staff-feedback.module.css";

export function StaffSpinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

export function StaffBusy({ floating = false }: { floating?: boolean }) {
  return (
    <span className={floating ? styles.floating : styles.busy} role="status">
      <StaffSpinner />
      {staffCopy.loading}
    </span>
  );
}

export function StaffNotice({
  message,
  guidance,
  children,
}: {
  message: string;
  guidance?: "technical" | "retry";
  children?: ReactNode;
}) {
  return (
    <div className={styles.notice}>
      <div role="alert">
        <strong>{message}</strong>
        {guidance && <p>{staffCopy.feedback[guidance]}</p>}
      </div>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

export function StaffFieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  return (
    <small className={styles.fieldError} id={id} aria-live="polite">
      {message}
    </small>
  );
}
