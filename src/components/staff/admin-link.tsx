"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAdminNavigation } from "./shell/admin-navigation";
import { StaffIcon } from "./staff-icon";
import styles from "./staff.module.css";

export function AdminLink({
  href,
  onNavigate,
  replace,
  scroll,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const navigation = useAdminNavigation();
  const newTab = props.target === "_blank";
  const disabled = navigation?.pending || props["aria-disabled"] === true;
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      replace={replace}
      scroll={scroll}
      aria-disabled={disabled || undefined}
      onNavigate={(event) => {
        if (disabled) return event.preventDefault();
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        // A link that opens its own tab must not be hijacked by the shell router:
        // cross-module jumps rely on it so the current record stays open behind them.
        if (props.target === "_blank") return;
        if (prevented || !navigation || !href.startsWith("/")) return;
        event.preventDefault();
        navigation.navigate(href, { replace, scroll });
      }}
    >
      {children}
      {/*
        Every admin link that opens its own tab says so. Staff jump between
        modules constantly and a link that silently leaves the record behind
        reads as a lost page; the glyph is the whole explanation.
      */}
      {newTab && (
        <span className={styles.newTabMark}>
          <StaffIcon name="newTab" />
        </span>
      )}
    </Link>
  );
}
