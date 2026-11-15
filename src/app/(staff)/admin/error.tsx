"use client";

import { StaffNotice } from "@/components/staff/staff-feedback";
import { staffCopy } from "@/i18n/staff-uk";
import styles from "@/components/staff/staff.module.css";

export default function AdminError() {
  return (
    <section className={styles.pageState}>
      <h1>{staffCopy.error}</h1>
      <StaffNotice message={staffCopy.feedback.technical} guidance="retry" />
      <button
        type="button"
        className={styles.action}
        onClick={() => window.location.reload()}
      >
        {staffCopy.retry}
      </button>
    </section>
  );
}
