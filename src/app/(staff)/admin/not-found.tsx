import Link from "next/link";
import { staffCopy } from "@/i18n/staff-uk";
import styles from "@/components/staff/staff.module.css";

export default function AdminNotFound() {
  return (
    <section className={styles.pageState}>
      <h1>{staffCopy.missing}</h1>
      <Link href="/admin" prefetch={false}>
        {staffCopy.back}
      </Link>
    </section>
  );
}
