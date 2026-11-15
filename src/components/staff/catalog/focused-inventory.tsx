"use client";
import { useRouter } from "next/navigation";
import type { InventoryRow } from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { InventoryTable } from "./inventory-table";
import s from "./catalog.module.css";
export function FocusedInventory({ rows }: { rows: InventoryRow[] | null }) {
  const router = useRouter();
  if (!rows)
    return (
      <div role="alert">
        <p>{copy.errors.unavailable}</p>
        <button
          type="button"
          className={s.button}
          onClick={() => router.refresh()}
        >
          {copy.retry}
        </button>
      </div>
    );
  return rows.length ? (
    <InventoryTable
      rows={rows}
      initiallyOpen
      reload={async () => router.refresh()}
    />
  ) : (
    <p>{copy.empty}</p>
  );
}
