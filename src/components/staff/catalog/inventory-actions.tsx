"use client";

import { useRef, useState } from "react";
import { clearInventoryAction } from "@/app/(staff)/admin/products/actions";
import type { InventoryRow } from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { AdminLink } from "../admin-link";
import { StaffConfirm } from "../staff-confirm";
import { StaffIcon } from "../staff-icon";
import styles from "./catalog.module.css";

export function InventoryActions({
  row,
  reload,
}: {
  row: InventoryRow;
  reload: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof copy.errors | null>(null);
  const request = useRef(false);
  const title = `${row.name} · ${row.weightGrams} ${copy.gramsShort}`;

  async function run() {
    if (request.current) return;
    request.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await clearInventoryAction(
        row.productId,
        row.id,
        row.revision,
      );
      if ("error" in result) return setError(result.error);
      setAsking(false);
      await reload();
    } catch {
      setError("unavailable");
    } finally {
      request.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.inventoryActions}>
      <AdminLink
        className={styles.iconAction}
        href={`/admin/products/inventory/${row.productId}/${row.id}`}
        aria-label={`${copy.edit} · ${title}`}
        title={copy.edit}
      >
        <StaffIcon name="content" />
      </AdminLink>
      <button
        type="button"
        className={`${styles.iconAction} ${styles.danger}`}
        aria-label={`${copy.clearInventory} · ${title}`}
        title={copy.clearInventory}
        onClick={() => {
          setError(null);
          setAsking(true);
        }}
      >
        <StaffIcon name="trash" />
      </button>
      <StaffConfirm
        open={asking}
        title={title}
        body={`${copy.clearInventoryConfirm}${
          row.stock.reserved > 0 ? ` ${copy.clearInventoryReserved}` : ""
        }`}
        confirmLabel={copy.clearInventory}
        danger
        busy={busy}
        error={
          error
            ? {
                message: copy.errors[error],
                technical: error === "unavailable",
              }
            : null
        }
        onConfirm={run}
        onDismiss={() => {
          if (!busy) setAsking(false);
        }}
      />
    </div>
  );
}
