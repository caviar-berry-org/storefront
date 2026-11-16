import { AdminLink } from "./admin-link";
import { catalogStaff } from "@/lib/server/catalog/access";
import { readDashboardMetrics } from "@/lib/server/dashboard-metrics";
import { staffCopy } from "@/i18n/staff-uk";
import { StaffHelp } from "./staff-help";
import { StaffNotice } from "./staff-feedback";
import { MetricValue } from "./metric-value";
import styles from "./dashboard-metrics.module.css";

const copy = staffCopy.dashboard;
const kyivDateTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Kyiv",
});

export async function DashboardMetrics() {
  const includeInventory = Boolean(await catalogStaff());
  const { orders, discounts, inventory, at } =
    await readDashboardMetrics(includeInventory);
  // Derived, not queried: the completed-orders aggregation already returns
  // both the count and the sum, so the average cheque costs nothing.
  const average = orders
    ? orders.count
      ? Math.round(orders.total / orders.count)
      : 0
    : undefined;
  const orderBook = "/admin/orders";
  const stock = "/admin/products/inventory";
  // Money over the whole order book first, live stock after it. Each tile
  // carries its own destination so reordering them cannot mislink one.
  const metrics = [
    {
      metric: copy.metrics.completed,
      value: orders?.count,
      href: orderBook,
      money: false,
    },
    {
      metric: copy.metrics.average,
      value: average,
      href: orderBook,
      money: true,
    },
    {
      metric: copy.metrics.total,
      value: orders?.total,
      href: orderBook,
      money: true,
    },
    {
      metric: copy.metrics.discount,
      value: discounts?.discount,
      href: orderBook,
      money: true,
    },
    {
      metric: copy.metrics.expiring,
      value: inventory?.expiring,
      href: stock,
      money: false,
    },
    {
      metric: copy.metrics.low,
      value: inventory?.low,
      href: stock,
      money: false,
    },
  ] as const;
  const restricted = new Set<string>([
    copy.metrics.expiring.title,
    copy.metrics.low.title,
  ]);
  return (
    <section aria-label={copy.metricsLabel}>
      <div className={styles.grid}>
        {metrics.map(({ metric, value, href, money }) => (
          <article className={styles.metric} key={metric.title}>
            <header>
              <h2>
                <AdminLink href={href}>{metric.title}</AdminLink>
              </h2>
              <StaffHelp
                label={metric.title}
                text={
                  !includeInventory && restricted.has(metric.title)
                    ? copy.inventoryRestricted
                    : metric.help
                }
                compact
              />
            </header>
            <MetricValue name={metric.title} value={value} currency={money} />
          </article>
        ))}
      </div>
      {at !== null && (
        <p className={styles.timestamp}>
          {copy.dataAsOf}{" "}
          <time dateTime={new Date(at).toISOString()}>
            {kyivDateTime.format(at)}
          </time>{" "}
          {copy.kyivTime}
        </p>
      )}
      {(!orders || !discounts || (includeInventory && !inventory)) && (
        <StaffNotice message={copy.metricsUnavailable} guidance="technical" />
      )}
    </section>
  );
}
