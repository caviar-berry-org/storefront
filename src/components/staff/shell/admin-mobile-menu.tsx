"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminMenu, type SignOut } from "./admin-menu";
import { StaffBrand } from "../staff-brand";
import { StaffIcon } from "../staff-icon";
import { StaffProfile, type StaffProfileData } from "../staff-profile";
import styles from "../staff.module.css";

export function AdminMobileMenu({
  signOut,
  profile,
  orderBadge,
  inquiryBadge,
}: {
  orderBadge: ReactNode;
  inquiryBadge: ReactNode;
  signOut: SignOut;
  profile: StaffProfileData;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeMenu = () => dialog.current?.close();

  useEffect(() => {
    const wideScreen = window.matchMedia("(min-width: 700px)");
    const closeOnResize = () => {
      if (wideScreen.matches) dialog.current?.close();
    };
    wideScreen.addEventListener("change", closeOnResize);
    return () => wideScreen.removeEventListener("change", closeOnResize);
  }, []);

  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  return (
    <>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={staffCopy.openMenu}
          aria-haspopup="dialog"
          aria-controls="staff-mobile-menu"
          aria-expanded={open}
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <StaffIcon name="menu" />
        </button>
        <StaffBrand mobile />
        <StaffProfile {...profile} />
      </header>
      <dialog
        id="staff-mobile-menu"
        ref={dialog}
        className={styles.drawer}
        aria-label={staffCopy.navigation}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className={styles.drawerInner}>
          <div className={styles.sidebarHeader}>
            <StaffBrand onNavigate={closeMenu} />
            <button
              type="button"
              className={styles.iconButton}
              aria-label={staffCopy.closeMenu}
              onClick={closeMenu}
            >
              <StaffIcon name="close" />
            </button>
          </div>
          <div className={styles.sidebarProfile}>
            <StaffProfile {...profile} onNavigate={closeMenu} />
          </div>
          <AdminMenu
            signOut={signOut}
            role={profile.role}
            onNavigate={closeMenu}
            orderBadge={orderBadge}
            inquiryBadge={inquiryBadge}
          />
        </div>
      </dialog>
    </>
  );
}
