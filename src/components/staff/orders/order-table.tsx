import { orderLifecycle, type OrderSummary } from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { formatMoney } from "@/lib/format-money";
import { AdminLink } from "../admin-link";
import { CustomerDate } from "../customers/customer-fields";
import directory from "../customers/customers.module.css";
import styles from "./orders.module.css";
import { StatusBadge } from "../status-badge";

export function OrderBadges({ order }: { order: OrderSummary }) {
  return (
    <div className={directory.badges}>
      <StatusBadge kind="order" value={order.status}>
        {copy.statuses[order.status]}
      </StatusBadge>
      <span
        className={directory.badge}
        data-segment={order.type === "corporate" ? "corporate" : undefined}
      >
        {copy.types[order.type]}
      </span>
    </div>
  );
}

/**
 * Money that has arrived versus money still owed — the one thing staff scan this
 * column for. Paid is a green tick; anything not yet paid is an amber clock,
 * whatever stage the order itself has reached.
 */
function PaymentMark({
  status,
}: {
  status?: NonNullable<OrderSummary["payment"]>["status"];
}) {
  const paid = status === "paid";
  const label = paid ? copy.paid : copy.awaitingPayment;
  return (
    <span
      className={styles.payMark}
      data-paid={paid}
      title={label}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {paid ? (
          <path
            d="M3.5 8.5l3 3 6-6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M8 4.8V8l2.2 1.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </span>
  );
}

export function OrderTable({ rows }: { rows: OrderSummary[] }) {
  return (
    <div
      className={directory.tableWrap}
      role="region"
      aria-label={staffCopy.sections.orders}
      tabIndex={0}
    >
      <table className={`${directory.table} ${styles.table}`}>
        <thead>
          <tr>
            <th scope="col">{copy.number}</th>
            <th scope="col">{copy.customer}</th>
            <th scope="col" className={styles.hideMedium}>
              {copy.contacts}
            </th>
            <th scope="col">{copy.total}</th>
            <th scope="col" className={styles.hideMedium}>
              {copy.promo}
            </th>
            <th scope="col" className={styles.hideSmall}>
              {copy.date}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr key={order.id} data-life={orderLifecycle(order.status)}>
              <td>
                <AdminLink
                  className={styles.rowLink}
                  href={`/admin/orders/${order.id}`}
                >
                  {order.number}
                </AdminLink>
                <OrderBadges order={order} />
              </td>
              <td>
                <div>{order.customer.name || copy.none}</div>
                <span
                  className={directory.badge}
                  data-segment={order.customer.type}
                >
                  {staffCopy.customerDirectory.types[order.customer.type]}
                </span>
              </td>
              <td className={styles.hideMedium}>
                <div>{order.customer.phone || copy.none}</div>
                <div>{order.customer.email}</div>
              </td>
              <td>
                <span className={styles.amount}>
                  <PaymentMark status={order.payment?.status} />
                  <strong>{formatMoney(order.totalMinor, "ua")}</strong>
                </span>
              </td>
              <td className={styles.hideMedium}>
                {order.promotion ? (
                  <span className={styles.promo} title={order.promotion.code}>
                    {order.promotion.percent}%
                  </span>
                ) : (
                  copy.none
                )}
              </td>
              <td className={styles.hideSmall}>
                <CustomerDate value={order.createdAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
