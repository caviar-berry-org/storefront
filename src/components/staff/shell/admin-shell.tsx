"use client";
import {
  InquiryCountsProvider,
  type InquiryCounts,
} from "../inquiries/inquiry-counts";

import { useState, type ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminMenu, type SignOut } from "./admin-menu";
import { AdminNavigation } from "./admin-navigation";
import { AdminMobileMenu } from "./admin-mobile-menu";
import { StaffBrand } from "../staff-brand";
import { StaffIcon } from "../staff-icon";
import { StaffProfile, type StaffProfileData } from "../staff-profile";
import styles from "../staff.module.css";

export function AdminShell({
  children,
  signOut,
  profile,
  initiallyCollapsed,
  orderBadge,
  inquiryBadge,
  initialInquiryCounts,
}: {
  orderBadge: ReactNode;
  inquiryBadge: ReactNode;
  initialInquiryCounts: InquiryCounts;
  children: ReactNode;
  initiallyCollapsed: boolean;
  signOut: SignOut;
  profile: StaffProfileData;
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const toggleLabel = collapsed ? staffCopy.expand : staffCopy.collapse;

  return (
    <InquiryCountsProvider initial={initialInquiryCounts}>
      <AdminNavigation>
        <div className={styles.shell} data-collapsed={collapsed}>
          <a href="#staff-main" className={styles.skip}>
            {staffCopy.skip}
          </a>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <StaffBrand />
            </div>
            <div className={styles.sidebarProfile}>
              <StaffProfile {...profile} />
            </div>
            <button
              type="button"
              className={styles.sidebarToggle}
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              title={toggleLabel}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                const secure = location.protocol === "https:" ? "; Secure" : "";
                document.cookie = `staff-sidebar=${next ? "collapsed" : "expanded"}; Path=/admin; Max-Age=31536000; SameSite=Lax${secure}`;
              }}
            >
              <StaffIcon name={collapsed ? "expand" : "collapse"} />
            </button>
            <AdminMenu
              signOut={signOut}
              role={profile.role}
              collapsed={collapsed}
              orderBadge={orderBadge}
              inquiryBadge={inquiryBadge}
            />
          </aside>
          <AdminMobileMenu
            signOut={signOut}
            profile={profile}
            orderBadge={orderBadge}
            inquiryBadge={inquiryBadge}
          />
          <main className={styles.workspace} id="staff-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </AdminNavigation>
    </InquiryCountsProvider>
  );
}
