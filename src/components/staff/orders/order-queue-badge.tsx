import { staffCopy } from "@/i18n/staff-uk";
import { readActiveOrderCount } from "@/lib/server/orders/queries";
import styles from "../staff.module.css";

export function OrderQueueValue({
  count,
  showZero = false,
}: {
  count: number | null;
  showZero?: boolean;
}) {
  if (count === null)
    return showZero ? (
      <span className={styles.queueValue} aria-label={staffCopy.unavailable}>
        —
      </span>
    ) : null;
  if (!showZero && count === 0) return null;
  return (
    <span
      className={styles.orderQueueCount}
      data-empty={count === 0}
      aria-label={`${staffCopy.dashboard.queue} ${count}`}
    >
      {count}
    </span>
  );
}

export async function OrderQueueBadge() {
  return <OrderQueueValue count={await readActiveOrderCount()} />;
}
