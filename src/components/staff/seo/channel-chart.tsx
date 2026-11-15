import type { ChannelShare } from "@/domain/analytics-window";
import { channelChartModel } from "@/domain/channel-chart";
import { formatMoney } from "@/lib/format-money";
import { seoStaffCopy } from "@/i18n/seo-staff-uk";
import styles from "./seo.module.css";

const copy = seoStaffCopy.utm;

const channelName = (source: string) =>
  copy.channels[source as keyof typeof copy.channels] ?? source;

/** Organ pipes: one column per channel, as tall as the orders it brought. */
export function ChannelChart({
  rows,
  orders,
}: {
  rows: readonly ChannelShare[];
  orders: number;
}) {
  const { sheet, plot, columns, ticks, average, axisRight, scrollWidth } =
    channelChartModel(rows, orders);

  return (
    <figure className={styles.chart}>
      <div
        className={styles.chartScroll}
        data-scrolls={scrollWidth || undefined}
      >
        <svg
          viewBox={`0 0 ${sheet.width} ${sheet.height}`}
          className={styles.chartSvg}
          style={scrollWidth ? { minWidth: `${scrollWidth}px` } : undefined}
          role="img"
          aria-label={copy.chartAlt.replace("{count}", String(columns.length))}
        >
          {ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={plot.left - 6}
                x2={axisRight}
                y1={tick.y}
                y2={tick.y}
                className={
                  tick.value === 0 ? styles.chartBase : styles.chartGrid
                }
              />
              <text
                x={plot.left - 10}
                y={tick.y + 4}
                className={styles.chartTick}
                textAnchor="end"
              >
                {tick.value}
              </text>
            </g>
          ))}

          {average && (
            <>
              <line
                x1={plot.left}
                x2={axisRight}
                y1={average.y}
                y2={average.y}
                className={styles.chartAverage}
              />
              <text
                x={axisRight}
                y={average.y + 15}
                className={styles.chartAverageLabel}
                textAnchor="end"
              >
                {copy.average}
              </text>
            </>
          )}

          {columns.map((column) => (
            <g key={column.source}>
              <title>{`${channelName(column.source)}: ${column.count}, ${column.share}%`}</title>
              <rect
                x={column.x}
                y={column.y}
                width={column.width}
                height={column.height}
                rx={column.radius}
                className={
                  column.lead ? styles.chartPipeLead : styles.chartPipe
                }
              />
              <text
                x={column.x + column.width / 2}
                y={column.y - 8}
                className={styles.chartValue}
                textAnchor="middle"
              >
                {column.count}
              </text>
              <text
                x={column.x + column.width / 2}
                y={plot.bottom + 18}
                className={styles.chartLabel}
                textAnchor="middle"
              >
                {channelName(column.source)}
              </text>
              <text
                x={column.x + column.width / 2}
                y={plot.bottom + 34}
                className={styles.chartShare}
                textAnchor="middle"
              >
                {column.share}%
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

/**
 * The same numbers as plain text. The chart shows the shape of the period; this
 * is what staff copy into a report, and the only version a screen reader reads.
 */
export function ChannelBreakdown({
  rows,
  orders,
  revenue,
}: {
  rows: readonly ChannelShare[];
  orders: number;
  revenue: number;
}) {
  return (
    <ol className={styles.breakdown}>
      {rows.map((row) => (
        <li key={row.source}>
          <span className={styles.breakdownName}>
            {channelName(row.source)}
          </span>
          <span className={styles.breakdownCount}>
            {copy.ordersCount.replace("{count}", String(row.count))}
          </span>
          <span className={styles.breakdownShare}>{row.share}%</span>
          <span className={styles.breakdownRevenue}>
            {formatMoney(row.total, "ua")}
          </span>
        </li>
      ))}
      <li className={styles.breakdownTotal}>
        <span className={styles.breakdownName}>{copy.totalLabel}</span>
        <span className={styles.breakdownCount}>
          {copy.ordersCount.replace("{count}", String(orders))}
        </span>
        <span className={styles.breakdownShare}>100%</span>
        <span className={styles.breakdownRevenue}>
          {formatMoney(revenue, "ua")}
        </span>
      </li>
    </ol>
  );
}
