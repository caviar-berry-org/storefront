"use client";

import { useRef, useState, type ReactNode } from "react";
import { changeCatalogVisibility } from "@/app/(staff)/admin/products/actions";
import type { CatalogKind, CatalogListEntry } from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { AdminLink } from "../admin-link";
import { StaffConfirm } from "../staff-confirm";
import { StaffIcon } from "../staff-icon";
import styles from "./catalog.module.css";

function ActionHint({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className={styles.actionHint}>
      {children}
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function CatalogActions({
  record,
  kind,
  title,
  reload,
  archived,
}: {
  record: CatalogListEntry;
  kind: CatalogKind;
  title: string;
  archived: boolean;
  reload: () => Promise<void>;
}) {
  const [operation, setOperation] = useState<
    "hide" | "restore" | "delete" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof copy.errors | null>(null);
  const request = useRef(false);
  const restoreLabel = archived ? copy.unarchive : copy.restore;
  function ask(value: NonNullable<typeof operation>) {
    setOperation(value);
    setError(null);
  }
  async function run() {
    if (request.current || !operation) return;
    request.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await changeCatalogVisibility(
        kind,
        record.id,
        record.revision,
        operation,
      );
      if ("error" in result) return setError(result.error);
      setOperation(null);
      await reload();
    } catch {
      setError("unavailable");
    } finally {
      request.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className={styles.rowActions}>
        <ActionHint label={copy.edit}>
          <AdminLink
            className={styles.iconAction}
            aria-label={copy.edit}
            href={`/admin/products/${kind}/${record.id}${archived ? "?from=archive" : ""}`}
          >
            <StaffIcon name="content" />
          </AdminLink>
        </ActionHint>
        <ActionHint label={record.published ? copy.hide : restoreLabel}>
          <button
            type="button"
            className={styles.iconAction}
            aria-label={record.published ? copy.hide : restoreLabel}
            onClick={() => ask(record.published ? "hide" : "restore")}
          >
            <StaffIcon name={record.published ? "archive" : "restore"} />
          </button>
        </ActionHint>
        <ActionHint label={copy.delete}>
          <button
            type="button"
            className={`${styles.iconAction} ${styles.danger}`}
            aria-label={copy.delete}
            onClick={() => ask("delete")}
          >
            <StaffIcon name="trash" />
          </button>
        </ActionHint>
      </div>
      <StaffConfirm
        open={operation !== null}
        title={title}
        body={operation ? copy.confirmation[operation] : ""}
        confirmLabel={
          operation === "restore"
            ? restoreLabel
            : operation
              ? copy[operation]
              : ""
        }
        danger={operation === "delete"}
        busy={busy}
        error={
          error
            ? {
                message: copy.errors[error],
                technical: error === "unavailable",
                // Stock is the one blocker staff can clear themselves, so the
                // refusal carries the way there instead of only naming it.
                action:
                  kind === "caviar" &&
                  (error === "linkedStock" || error === "linkedReserved") ? (
                    <AdminLink
                      className={styles.button}
                      href={`/admin/products/inventory?product=${encodeURIComponent(record.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {copy.openInventory}
                    </AdminLink>
                  ) : undefined,
              }
            : null
        }
        onConfirm={run}
        onDismiss={() => {
          if (!busy) setOperation(null);
        }}
      />
    </>
  );
}
