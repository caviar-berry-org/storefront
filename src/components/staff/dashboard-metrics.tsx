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
  const destinations = [
    "/admin/orders",
    "/admin/orders",
    "/admin/products/inventory",
    "/admin/orders",
    "/admin/products/inventory",
    "/admin/products/inventory",
  ];
  const metrics = [
    [copy.metrics.completed, orders?.count, false],
    [copy.metrics.total, orders?.total, true],
    [copy.metrics.expiring, inventory?.expiring, false],
    [copy.metrics.discount, discounts?.discount, true],
    [copy.metrics.expired, inventory?.expired, false],
    [copy.metrics.low, inventory?.low, false],
  ] as const;
  return (
    <section aria-label={copy.metricsLabel}>
      <div className={styles.grid}>
        {metrics.map(([metric, value, currency], index) => (
          <article className={styles.metric} key={metric.title}>
            <header>
              <h2>
                <AdminLink href={destinations[index]!}>
                  {metric.title}
                </AdminLink>
              </h2>
              <StaffHelp
                label={metric.title}
                text={
                  !includeInventory &&
                  [
                    copy.metrics.expiring.title,
                    copy.metrics.expired.title,
                    copy.metrics.low.title,
                  ].some((title) => title === metric.title)
                    ? copy.inventoryRestricted
                    : metric.help
                }
                compact
              />
            </header>
            <MetricValue
              name={metric.title}
              value={value}
              currency={currency}
            />
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
