"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { type StaffRole } from "@/domain/staff-team";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "../admin-link";
import { adminPath, navigationFor } from "../navigation";
import { StaffIcon } from "../staff-icon";
import styles from "../staff.module.css";

export type SignOut = () => Promise<void>;

export function AdminMenu({
  signOut,
  role,
  onNavigate,
  collapsed = false,
  orderBadge,
  inquiryBadge,
}: {
  signOut: SignOut;
  role: StaffRole;
  onNavigate?: () => void;
  collapsed?: boolean;
  orderBadge: ReactNode;
  inquiryBadge: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className={styles.navigation} aria-label={staffCopy.navigation}>
        {navigationFor(role).map(({ label, sections }) => (
          <div className={styles.navGroup} key={label}>
            <p className={styles.groupLabel}>{label}</p>
            <ul>
              {sections.map(({ slug, name }) => {
                const root = adminPath(slug);
                const href =
                  slug === "products" ? adminPath("products/caviar") : root;
                const exact = pathname === href;
                const active =
                  exact || (slug !== "" && pathname.startsWith(root + "/"));
                return (
                  <li key={name}>
                    <AdminLink
                      href={href}
                      className={styles.navItem}
                      data-active={active}
                      aria-current={exact ? "page" : undefined}
                      title={collapsed ? staffCopy.sections[name] : undefined}
                      onClick={onNavigate}
                    >
                      <StaffIcon name={name} />
                      <span className={styles.navLabel}>
                        {staffCopy.sections[name]}
                      </span>
                      {slug === "orders" && orderBadge}
                      {slug === "inquiries" && inquiryBadge}
                    </AdminLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <form action={signOut} className={styles.signOut}>
        <button type="submit" className={styles.navItem}>
          <StaffIcon name="signOut" />
          <span className={styles.navLabel}>{staffCopy.signOut}</span>
          <span className={styles.navTooltip} aria-hidden="true">
            {staffCopy.signOut}
          </span>
        </button>
      </form>
    </>
  );
}
