"use client";

import AdminError from "./admin/error";
import styles from "@/components/staff/staff.module.css";

export default function StaffError() {
  return (
    <main className={styles.signInPage}>
      <AdminError />
    </main>
  );
}
