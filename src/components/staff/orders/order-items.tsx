import type { Order } from "@/domain/orders";
import { validCatalogId } from "@/domain/managed-catalog";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { formatMoney } from "@/lib/format-money";
import { AdminLink } from "../admin-link";
import styles from "./orders.module.css";

const money = (minor: number) => formatMoney(minor, "ua");

export function OrderItems({
  order,
  canOpenInventory,
}: {
  order: Order;
  canOpenInventory: boolean;
}) {
  return (
    <>
      <ul className={styles.lines}>
        {order.lines.map((line, index) => {
          const href =
            canOpenInventory &&
            validCatalogId(line.productId) &&
            validCatalogId(line.variantId)
              ? `/admin/products/inventory/${line.productId}/${line.variantId}?fromOrder=${order.id}`
              : null;
          const label = `${line.name} · ${line.weightGrams} ${copy.weight}`;
          return (
            <li key={`${line.variantId}-${index}`}>
              <div>
                {href ? (
                  <AdminLink
                    href={href}
                    title={copy.inventory}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                  </AdminLink>
                ) : (
                  <strong>{label}</strong>
                )}
                <div className={styles.muted}>
                  {line.quantity} {copy.unit} × {money(line.unitPriceMinor)}
                </div>
                {line.batches?.map((batch, batchIndex) => (
                  <div className={styles.muted} key={batchIndex}>
                    {copy.batch} {batch.code} · {batch.quantity} {copy.unit} ·{" "}
                    {copy.expires}{" "}
                    <time dateTime={batch.expiresOn}>
                      {batch.expiresOn.split("-").reverse().join(".")}
                    </time>
                  </div>
                ))}
              </div>
              <strong>{money(line.quantity * line.unitPriceMinor)}</strong>
            </li>
          );
        })}
      </ul>
      <dl className={styles.totals}>
        <div>
          <dt>{copy.subtotal}</dt>
          <dd>{money(order.subtotalMinor)}</dd>
        </div>
        <div>
          <dt>
            {copy.discount}
            {order.promotion &&
              ` · ${order.promotion.code} (${order.promotion.percent}%)`}
          </dt>
          <dd>{money(order.discountMinor)}</dd>
        </div>
        {order.shippingMinor !== undefined && (
          <div>
            <dt>{copy.shipping}</dt>
            <dd>{money(order.shippingMinor)}</dd>
          </div>
        )}
        <div>
          <dt>
            <strong>{copy.total}</strong>
          </dt>
          <dd>
            <strong>{money(order.totalMinor)}</strong>
          </dd>
        </div>
      </dl>
    </>
  );
}
