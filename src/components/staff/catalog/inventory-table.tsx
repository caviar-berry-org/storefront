"use client";

import { StatusBadge } from "../status-badge";
import { InventoryActions } from "./inventory-actions";
import {
  inventoryExpiryWindowEnd,
  isLowInventory,
  stockOutsideReserve,
} from "@/domain/inventory-alerts";
import { kyivDate } from "@/domain/inquiry";
import type { InventoryRow } from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { CatalogGroup } from "./catalog-group";
import { AdminLink } from "../admin-link";
import { StaffIcon } from "../staff-icon";
import styles from "./catalog.module.css";

export function InventoryTable({
  rows,
  reload,
  initiallyOpen = false,
}: {
  rows: InventoryRow[];
  reload: () => Promise<void>;
  initiallyOpen?: boolean;
}) {
  if (!rows.length) return null;
  const today = kyivDate();
  const warningDate = inventoryExpiryWindowEnd(today);
  const products = new Map<string, InventoryRow[]>();
  for (const row of rows) {
    const packs = products.get(row.productId);
    if (packs) packs.push(row);
    else products.set(row.productId, [row]);
  }
  const columns = [
    copy.weight,
    copy.quantity,
    copy.reserved,
    copy.outsideReserve,
    copy.batch,
    copy.batchQuantity,
    copy.expiryColumn,
    copy.inventoryActions,
  ];

  return (
    <div className={styles.inventoryGroups}>
      {[...products].map(([productId, packs]) => {
        const expired = packs.some(({ stock }) =>
          stock.batches.some(({ expiresOn }) => expiresOn < today),
        );
        return (
          <CatalogGroup
            key={productId}
            title={packs[0]!.name}
            initiallyOpen={initiallyOpen}
            collapsible
            badge={
              expired && (
                <StatusBadge tone="problem">{copy.expiryAttention}</StatusBadge>
              )
            }
          >
            <div
              className={styles.inventoryScroll}
              tabIndex={0}
              role="region"
              aria-label={packs[0]!.name}
            >
              <table className={styles.inventoryTable}>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th scope="col" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {packs.flatMap((row) => {
                    const outsideReserve = stockOutsideReserve(row.stock);
                    const low = isLowInventory(row.stock, row.enabled);
                    const batches = [...row.stock.batches].sort((a, b) =>
                      a.expiresOn.localeCompare(b.expiresOn),
                    );
                    return (batches.length ? batches : [null]).map(
                      (batch, index) => {
                        const expires = batch?.expiresOn;
                        const warning = expires && expires < warningDate;
                        const expired = Boolean(expires && expires < today);
                        return (
                          <tr
                            key={`${row.id}-${index}`}
                            data-expiry-warning={warning || undefined}
                            data-expired={expired || undefined}
                            data-pack-start={index === 0 || undefined}
                          >
                            <th scope="row">
                              {index === 0 && (
                                <AdminLink
                                  href={`/admin/products/caviar/${productId}?variant=${row.id}&from=inventory`}
                                >
                                  {row.weightGrams} г
                                </AdminLink>
                              )}
                            </th>
                            <td>
                              {index === 0 &&
                                (row.stock.quantity ?? copy.notSet)}
                            </td>
                            <td>{index === 0 && row.stock.reserved}</td>
                            <td>
                              {index === 0 && (
                                <span
                                  className={
                                    low ? styles.inventoryWarning : undefined
                                  }
                                  title={low ? copy.lowStock : undefined}
                                >
                                  {outsideReserve ?? copy.notSet}
                                  {low && <StaffIcon name="down" />}
                                </span>
                              )}
                            </td>
                            <td>{batch?.code ?? "—"}</td>
                            <td>{batch?.quantity ?? "—"}</td>
                            <td>
                              {expires ? (
                                <span
                                  className={
                                    warning
                                      ? styles.inventoryWarning
                                      : undefined
                                  }
                                  title={
                                    warning && !expired
                                      ? copy.expiring
                                      : undefined
                                  }
                                >
                                  <time dateTime={expires}>
                                    {expires.split("-").reverse().join(".")}
                                  </time>
                                  {expired ? (
                                    <StatusBadge tone="problem">
                                      {copy.expired}
                                    </StatusBadge>
                                  ) : (
                                    warning && <StaffIcon name="flame" />
                                  )}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {index === 0 && (
                                <InventoryActions row={row} reload={reload} />
                              )}
                            </td>
                          </tr>
                        );
                      },
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CatalogGroup>
        );
      })}
    </div>
  );
}
