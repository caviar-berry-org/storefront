"use client";

import { useEffect, useRef, useState } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { StaffIcon } from "./staff-icon";
import styles from "./staff-facts.module.css";

/**
 * Copies one value without its label. Staff paste addresses and numbers into the
 * carrier cabinet and the banking app, so the value must arrive clean.
 */
export function StaffCopyButton({
  value,
  label,
  variant = "inline",
}: {
  value: string;
  label: string;
  /** "action" is a standalone control with its own label, not a field affordance. */
  variant?: "inline" | "action";
}) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setFailed(false);
      setDone(true);
      timer.current = setTimeout(() => setDone(false), 1600);
    } catch {
      // No clipboard permission: the value stays selectable by hand.
      setDone(false);
      setFailed(true);
    }
  }

  return (
    <button
      type="button"
      className={variant === "action" ? styles.copyAction : styles.copy}
      onClick={copy}
      data-done={done || undefined}
      title={`${staffCopy.facts.copy} · ${label}`}
      aria-label={`${staffCopy.facts.copy} · ${label}`}
    >
      <StaffIcon name={done ? "check" : "copy"} />
      <span>
        {done
          ? staffCopy.facts.copied
          : failed
            ? staffCopy.facts.copyFailed
            : variant === "action"
              ? label
              : staffCopy.facts.copy}
      </span>
    </button>
  );
}
