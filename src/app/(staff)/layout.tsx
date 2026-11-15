import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "@/components/staff/staff.module.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Shared by the staff App Router root. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=EB+Garamond:wght@400;500&family=Unbounded:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={styles.body}>{children}</body>
    </html>
  );
}
