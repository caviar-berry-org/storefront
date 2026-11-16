import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { readOrderCounts } from "@/lib/server/orders/queries";
import styles from "./order-tally.module.css";

const dashboard = staffCopy.dashboard;
const kyivDateTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Kyiv",
});

/**
 * A tally above the list, not a dashboard: no links, no tooltips, one figure
 * each. The left edge carries the same colours as the row tints below, so a
 * glance down the page reads as one language rather than two.
 *
 * Silent when the counts are unavailable — a summary is worth nothing if it
 * might be wrong, and the list underneath is the real record.
 */
export async function OrderTally() {
  const counts = await readOrderCounts();
  if (!counts) return null;
  const cells = [
    [copy.tally.total, counts.total, undefined],
    [copy.tally.new, counts.new, "new"],
    [copy.tally.open, counts.open, "open"],
    [copy.tally.received, counts.done, "done"],
    [copy.tally.problem, counts.problem, "problem"],
  ] as const;
  return (
    <section aria-label={copy.tally.label}>
      <div className={styles.tally}>
        {cells.map(([label, value, tone]) => (
          <article className={styles.cell} key={label} data-tone={tone}>
            <span className={styles.label}>{label}</span>
            <span className={styles.figure}>{value}</span>
          </article>
        ))}
      </div>
      <p className={styles.stamp}>
        {dashboard.dataAsOf}{" "}
        <time dateTime={new Date(counts.at).toISOString()}>
          {kyivDateTime.format(counts.at)}
        </time>{" "}
        {dashboard.kyivTime}
      </p>
    </section>
  );
}
