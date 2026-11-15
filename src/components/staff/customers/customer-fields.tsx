import { staffCopy } from "@/i18n/staff-uk";
import type { CustomerSummary } from "@/domain/customer-directory";
import styles from "./customers.module.css";

const copy = staffCopy.customerDirectory;
const date = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Kyiv",
});

export function CustomerDate({
  value,
  status,
}: {
  value: number;
  status?: "recent" | "stale";
}) {
  return (
    <time
      dateTime={new Date(value).toISOString()}
      className={status ? styles.interactionDate : undefined}
      data-status={status}
      title={
        status === "recent"
          ? copy.recentInteraction
          : status === "stale"
            ? copy.staleInteraction
            : undefined
      }
    >
      {date.format(value)}
    </time>
  );
}

export function CustomerBadges({ customer }: { customer: CustomerSummary }) {
  return (
    <div className={styles.badges}>
      <span className={styles.badge} data-segment={customer.type}>
        {copy.types[customer.type]}
      </span>
    </div>
  );
}
