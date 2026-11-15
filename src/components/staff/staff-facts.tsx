import type { ReactNode } from "react";
import { StaffCopyButton } from "./staff-copy";
import styles from "./staff-facts.module.css";

/**
 * Label above value, never beside it: a value on its own line can be selected
 * and copied without dragging its service label along.
 */
export function StaffFacts({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={`${styles.facts}${className ? ` ${className}` : ""}`}>
      {children}
    </dl>
  );
}

/**
 * `weight` carries importance, not decoration: `lead` for the figure the page is
 * about, `strong` for data staff act on, `dim` for service values.
 */
export function StaffFact({
  label,
  children,
  weight = "normal",
  copy,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  weight?: "lead" | "strong" | "normal" | "dim";
  /** Exact text to put on the clipboard; adds a copy control. */
  copy?: string;
  wide?: boolean;
}) {
  return (
    <div className={styles.fact} data-wide={wide || undefined}>
      <dt>
        {label}
        {copy && <StaffCopyButton value={copy} label={label} />}
      </dt>
      <dd data-weight={weight}>{children}</dd>
    </div>
  );
}
