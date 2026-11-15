"use client";

import { useEffect, useId, useRef, useState } from "react";
import { StaffIcon } from "./staff-icon";
import styles from "./staff-help.module.css";

export function StaffHelp({
  label,
  text,
  compact,
}: {
  label: string;
  text: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={styles.help}
      data-compact={compact || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={() => {
        if (document.activeElement !== trigger.current) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <StaffIcon name="info" />
      </button>
      {open && (
        <p id={id} role="tooltip">
          {text}
        </p>
      )}
    </div>
  );
}
