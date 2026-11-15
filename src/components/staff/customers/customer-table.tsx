import type { CustomerSummary } from "@/domain/customer-directory";
import { kyivDate } from "@/domain/inquiry";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "../admin-link";
import { CustomerBadges, CustomerDate } from "./customer-fields";
import { adminPath } from "../navigation";
import styles from "./customers.module.css";

const copy = staffCopy.customerDirectory;

function interactionThresholds(today: string) {
  const weekAgo = new Date(Date.parse(today) - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const month = new Date(today);
  const day = month.getUTCDate();
  const monthAfterTarget = month.getUTCMonth() - 2;
  month.setUTCMonth(monthAfterTarget, 0);
  month.setUTCDate(Math.min(day, month.getUTCDate()));
  return { weekAgo, threeMonthsAgo: month.toISOString().slice(0, 10) };
}

export function CustomerTable({
  rows,
  today,
}: {
  rows: CustomerSummary[];
  today: string;
}) {
  const { weekAgo, threeMonthsAgo } = interactionThresholds(today);
  function interactionStatus(value: number) {
    const day = kyivDate(new Date(value));
    if (day < threeMonthsAgo) return "stale";
    if (day > weekAgo && day <= today) return "recent";
  }

  return (
    <div
      className={styles.tableWrap}
      role="region"
      aria-label={staffCopy.sections.customers}
      tabIndex={0}
    >
      <table
        className={styles.table}
        aria-label={staffCopy.sections.customers}
        role="table"
      >
        <thead role="rowgroup">
          <tr role="row">
            {[
              copy.customer,
              copy.contacts,
              copy.orders,
              copy.sources,
              copy.lastInteraction,
            ].map((heading) => (
              <th key={heading} scope="col" role="columnheader">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((customer) => (
            <tr
              key={customer.id}
              role="row"
              data-without-orders={customer.orderCount === 0 || undefined}
            >
              <td role="cell">
                <AdminLink
                  href={adminPath(`customers/${customer.id}`)}
                  className={styles.customerLink}
                >
                  {customer.name ||
                    customer.email ||
                    customer.phone ||
                    copy.noName}
                </AdminLink>
                <CustomerBadges customer={customer} />
              </td>
              <td role="cell">
                <div>{customer.phone || copy.noValue}</div>
                {customer.email && <div>{customer.email}</div>}
              </td>
              <td role="cell">
                {customer.orderCount > 0 ? (
                  <span
                    className={styles.orderCount}
                    data-tier={
                      customer.orderCount >= 10
                        ? "high"
                        : customer.orderCount >= 3
                          ? "medium"
                          : undefined
                    }
                  >
                    {customer.orderCount}
                  </span>
                ) : (
                  <span className={styles.muted}>{copy.noOrders}</span>
                )}
              </td>
              <td role="cell">
                <div className={styles.badges}>
                  {customer.sources.length
                    ? customer.sources.map((kind) => (
                        <span
                          key={kind}
                          className={styles.badge}
                          data-source={kind}
                        >
                          {copy.kinds[kind]}
                        </span>
                      ))
                    : copy.noValue}
                </div>
              </td>
              <td role="cell">
                <CustomerDate
                  value={customer.lastInteractionAt}
                  status={interactionStatus(customer.lastInteractionAt)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
