"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { StaffNotice, StaffSpinner } from "./staff-feedback";
import styles from "./catalog/catalog.module.css";

/**
 * The one confirmation dialog in the admin. Every action that cannot be undone,
 * archives a record, or sends a message to a customer goes through it, so the
 * consequence is always stated before the action runs.
 */
export function StaffConfirm({
  open,
  title,
  body,
  confirmLabel,
  notice,
  danger = false,
  busy = false,
  error,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** A consequence that outlives the action and needs more weight than the body. */
  notice?: string;
  danger?: boolean;
  busy?: boolean;
  error?: {
    message: string;
    technical?: boolean;
    /** A way out of the refusal — the record the blocker lives in. */
    action?: ReactNode;
  } | null;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby={id}
      aria-describedby={`${id}-body`}
      onCancel={(event) => {
        // Escape must not abandon an action that is already running.
        if (busy) event.preventDefault();
      }}
      onClose={() => {
        if (!busy) onDismiss();
      }}
    >
      <h2 id={id}>{title}</h2>
      <p id={`${id}-body`}>{body}</p>
      {notice && <StaffNotice message={notice} />}
      {error && (
        <StaffNotice
          message={error.message}
          guidance={error.technical ? "technical" : undefined}
        >
          {error.action}
        </StaffNotice>
      )}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          disabled={busy}
          onClick={onDismiss}
        >
          {staffCopy.confirm.cancel}
        </button>
        <button
          type="button"
          className={danger ? styles.danger : styles.primary}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy && <StaffSpinner />}
          {busy ? staffCopy.loading : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
