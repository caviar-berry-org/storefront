"use client";
import { StaffHelp } from "../staff-help";

import { useRef, useState } from "react";
import { saveInventoryAction } from "@/app/(staff)/admin/products/actions";
import {
  batchTotal,
  unbatchedQuantity,
  type CatalogRecord,
} from "@/domain/managed-catalog";
import { kyivDate } from "@/domain/inquiry";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { CatalogEditorForm } from "./catalog-editor-form";
import { CatalogGroup } from "./catalog-group";
import { CatalogText } from "./catalog-text";
import { StaffIcon } from "../staff-icon";
import { StaffRecord } from "../staff-record";
import styles from "./catalog.module.css";

export function InventoryEditor({
  record,
  packId,
  title,
  back,
}: {
  record: CatalogRecord<"caviar">;
  packId: string;
  title: string;
  back: { href: string; label: string };
}) {
  const stock = record.data.stock[packId]!;
  const [batches, setBatches] = useState(
    stock.batches.map((batch, key) => ({ ...batch, key })),
  );
  const [assignedKey, setAssignedKey] = useState<number>();
  const counter = useRef(batches.length);
  const today = kyivDate();
  const assigned = batches.some(({ key }) => key === assignedKey);
  const unbatched = assigned ? 0 : unbatchedQuantity(stock);
  const total = batchTotal(batches) + unbatched;

  function addBatch(quantity = 0) {
    const key = counter.current++;
    setBatches((rows) => [...rows, { key, code: "", expiresOn: "", quantity }]);
    return key;
  }

  return (
    <StaffRecord
      back={back}
      title={title}
      action={
        <div className={styles.stockSummary}>
          <output>
            {copy.quantity} · <strong>{total} шт.</strong>
          </output>
          <StaffHelp label={copy.batches} text={copy.inventoryHelp} />
          <span>
            {copy.reserved} · {stock.reserved} шт.
          </span>
        </div>
      }
    >
      <CatalogEditorForm
        back={back.href}
        save={(form) =>
          saveInventoryAction(record.id, packId, record.revision, form)
        }
        // Becoming sellable again releases the queued "back in stock" letters.
        confirm={() =>
          total > stock.reserved && (stock.quantity ?? 0) <= stock.reserved
            ? {
                title: copy.restockConfirmTitle,
                body: copy.restockConfirmBody,
                label: copy.restockConfirmSave,
              }
            : null
        }
      >
        {(error) => (
          <CatalogGroup title={copy.batches} help={copy.batchHelp}>
            <input type="hidden" name="batchCount" value={batches.length} />
            {assigned && (
              <input type="hidden" name="assignUnbatched" value="on" />
            )}
            {unbatched > 0 && (
              <div className={styles.stockSummary}>
                <span>
                  {copy.unbatched} · {unbatched} шт.
                </span>
                <button
                  className={styles.button}
                  type="button"
                  disabled={batches.length >= 30}
                  onClick={() => {
                    setAssignedKey(addBatch(unbatched));
                  }}
                >
                  {copy.assignUnbatched}
                </button>
              </div>
            )}
            {batches.map((batch, index) => {
              const batchLabel = `${copy.batch} ${index + 1}`;
              return (
                <fieldset
                  className={`${styles.item} ${styles.batchRow}`}
                  key={batch.key}
                >
                  <legend>
                    {batchLabel}
                    {batch.expiresOn && batch.expiresOn < today
                      ? ` · ${copy.expired}`
                      : ""}
                  </legend>
                  <CatalogText
                    name={`batch.${index}.code`}
                    label={copy.batchCode}
                    required
                    limit={80}
                    value={batch.code}
                    error={error(`batch.${index}.code`)}
                  />
                  <CatalogText
                    name={`batch.${index}.quantity`}
                    label={copy.batchUnits}
                    required
                    limit={7}
                    pattern="[0-9]+"
                    inputMode="numeric"
                    value={batch.quantity}
                    onValueChange={(value) => {
                      const quantity = /^\d{1,7}$/.test(value)
                        ? Number(value)
                        : 0;
                      setBatches((rows) =>
                        rows.map((row) =>
                          row.key === batch.key ? { ...row, quantity } : row,
                        ),
                      );
                    }}
                    error={error(`batch.${index}.quantity`)}
                  />
                  <CatalogText
                    name={`batch.${index}.expiresOn`}
                    label={copy.expiry}
                    required
                    type="date"
                    value={batch.expiresOn}
                    error={error(`batch.${index}.expiresOn`)}
                  />
                  <button
                    className={`${styles.button} ${styles.batchRemove}`}
                    type="button"
                    aria-label={`${copy.remove} · ${batchLabel}`}
                    onClick={() =>
                      setBatches((rows) =>
                        rows.filter(({ key }) => key !== batch.key),
                      )
                    }
                  >
                    <StaffIcon name="trash" />
                  </button>
                </fieldset>
              );
            })}
            {error("batchCount") && (
              <p role="alert" className={styles.error}>
                {copy.batchDuplicate}
              </p>
            )}
            {error("quantity") && (
              <p role="alert" className={styles.error}>
                {copy.batchTotalError}
              </p>
            )}
            <div>
              <button
                className={styles.button}
                type="button"
                disabled={batches.length >= 30}
                onClick={() => addBatch()}
              >
                {copy.addBatch}
              </button>
            </div>
          </CatalogGroup>
        )}
      </CatalogEditorForm>
    </StaffRecord>
  );
}
