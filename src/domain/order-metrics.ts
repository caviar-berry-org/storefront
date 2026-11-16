/**
 * Order status groups and the geometry of the dashboard trend chart.
 *
 * Kept pure so both the staff tally and the chart read the same grouping, and
 * so the drawing can be tested without a database, a browser or the admin
 * shell around it. Every value here is in sheet units, never screen pixels.
 */
import { kyivDay, kyivDayStart } from "./analytics-window.ts";
import {
  calendarAxisLabels,
  chartHeight,
  niceScale,
  plotBox,
  smoothPath,
  spanLabel,
  tickLabel,
  type AxisLabel,
  type PlotBox,
} from "./chart.ts";
import type { OrderStatus } from "./orders.ts";

const dayMs = 86400000;

/**
 * Windows for the trend chart. Deliberately separate from `analyticsPeriods`:
 * the UTM panel reports a whole year, this chart stops at 60 days because
 * every extra bucket costs another round of aggregations.
 */
export const orderTrendPeriods = ["week", "month", "sixty"] as const;

export type OrderTrendPeriod = (typeof orderTrendPeriods)[number];

export const isOrderTrendPeriod = (value: unknown): value is OrderTrendPeriod =>
  orderTrendPeriods.some((period) => period === value);

/** Days covered, today included. */
export const orderTrendPeriodDays: Record<OrderTrendPeriod, number> = {
  week: 7,
  month: 30,
  sixty: 60,
};

/**
 * Days per plotted point. Sixty days are paired so the sheet never carries
 * more than thirty buckets: the queries scale with the bucket count, and past
 * thirty points four lines stop being readable anyway.
 */
export const orderTrendBucketDays: Record<OrderTrendPeriod, number> = {
  week: 1,
  month: 1,
  sixty: 2,
};

/** Drawing order is reading order: finished, moving, waiting, failed. */
export const orderGroups = ["done", "open", "new", "problem"] as const;

export type OrderGroup = (typeof orderGroups)[number];

export type OrderGroupCounts = Record<OrderGroup, number>;

/**
 * Statuses counted by their own query. `open` is absent on purpose — it is
 * whatever is left over, so a status added later lands there instead of
 * silently vanishing from the chart. The same reasoning as the staff tally.
 */
export const countedGroupStatuses = {
  new: ["new"],
  done: ["received"],
  problem: ["dispute", "cancelled"],
} as const satisfies Record<string, readonly OrderStatus[]>;

/** What `open` covers today; documentation, never a query. */
export const openGroupStatuses = [
  "viewed",
  "processing",
  "awaitingPayment",
  "packed",
  "shipped",
  "atBranch",
] as const satisfies readonly OrderStatus[];

export type CountedStatuses = {
  new: number;
  received: number;
  cancelled: number;
  dispute: number;
};

/**
 * A dispute is not work in progress — it is an order that went wrong, and it
 * belongs beside the cancelled ones in every reading of the order book.
 */
export function groupOrderCounts(
  total: number,
  counts: CountedStatuses,
): OrderGroupCounts {
  const problem = counts.cancelled + counts.dispute;
  return {
    done: counts.received,
    open: Math.max(0, total - counts.new - counts.received - problem),
    new: counts.new,
    problem,
  };
}

/** `YYYY-MM-DD` shifted by whole Kyiv days, DST included. */
export function addKyivDays(day: string, days: number) {
  // Midday keeps the arithmetic clear of the hour a DST switch adds or removes.
  return kyivDay(kyivDayStart(day) + days * dayMs + dayMs / 2);
}

export type TrendBucketRange = {
  /** Inclusive lower bound, epoch ms. */
  from: number;
  /** Exclusive upper bound, epoch ms. */
  to: number;
  firstDay: string;
  /** Inclusive, equal to `firstDay` for single-day buckets. */
  lastDay: string;
};

export type OrderTrendWindow = {
  period: OrderTrendPeriod;
  from: number;
  to: number;
  firstDay: string;
  lastDay: string;
  days: number;
  buckets: TrendBucketRange[];
};

/**
 * Whole Kyiv days ending with today, split into equal buckets. Snapped to
 * midnight rather than "now minus N days" so a chart opened twice in one
 * afternoon covers the same days both times and the cache key agrees with the
 * range the labels name.
 */
export function orderTrendWindow(
  period: OrderTrendPeriod,
  now = Date.now(),
): OrderTrendWindow {
  return orderTrendWindowFrom(
    period,
    addKyivDays(kyivDay(now), -(orderTrendPeriodDays[period] - 1)),
  );
}

/**
 * The same window addressed by its first day. The server caches on that day,
 * so a cached answer always describes the days its labels name — and rebuilds
 * the identical buckets without carrying them through the cache key.
 */
export function orderTrendWindowFrom(
  period: OrderTrendPeriod,
  firstDay: string,
): OrderTrendWindow {
  const days = orderTrendPeriodDays[period];
  const step = orderTrendBucketDays[period];
  const buckets: TrendBucketRange[] = [];
  for (let index = 0; index * step < days; index++) {
    const start = addKyivDays(firstDay, index * step);
    const afterEnd = addKyivDays(firstDay, Math.min((index + 1) * step, days));
    buckets.push({
      from: kyivDayStart(start),
      to: kyivDayStart(afterEnd),
      firstDay: start,
      lastDay: addKyivDays(afterEnd, -1),
    });
  }
  const lastDay = addKyivDays(firstDay, days - 1);
  return {
    period,
    from: kyivDayStart(firstDay),
    to: kyivDayStart(addKyivDays(lastDay, 1)),
    firstDay,
    lastDay,
    days,
    buckets,
  };
}

export type OrderTrendBucket = TrendBucketRange & { counts: OrderGroupCounts };

/**
 * The order trend sheet: four lines over one window, built from the shared
 * chart primitives so every staff chart measures, steps and smooths alike.
 * See `src/domain/chart.ts` for the rules this inherits.
 */
export type TrendPoint = { x: number; y: number; value: number; index: number };

export type TrendSeries = {
  group: OrderGroup;
  points: TrendPoint[];
  path: string;
  total: number;
};

export type TrendColumn = {
  index: number;
  x: number;
  firstDay: string;
  lastDay: string;
  label: string;
  counts: OrderGroupCounts;
};

export type OrderTrendModel = {
  width: number;
  height: number;
  plot: PlotBox;
  series: TrendSeries[];
  ticks: { value: number; label: string; y: number }[];
  labels: AxisLabel[];
  /** One per bucket, so a pointer anywhere can find the nearest reading. */
  columns: TrendColumn[];
  orders: number;
  empty: boolean;
};

export function orderTrendModel(
  buckets: readonly OrderTrendBucket[],
  width: number,
  height = chartHeight,
): OrderTrendModel {
  const peak = Math.max(
    0,
    ...buckets.flatMap((bucket) => orderGroups.map((g) => bucket.counts[g])),
  );
  const scale = niceScale(peak);
  // The margin is sized from the ticks it has to print, so a busy shop whose
  // counts reach four digits does not lose its axis off the left edge.
  const plot = plotBox(width, height, scale.values);
  const span = plot.right - plot.left;
  const rise = plot.bottom - plot.top;
  const y = (value: number) => plot.bottom - (value / scale.ceiling) * rise;
  const x = (index: number) =>
    buckets.length > 1
      ? plot.left + (index / (buckets.length - 1)) * span
      : plot.left + span / 2;

  const series = orderGroups.map((group) => {
    const points = buckets.map((bucket, index) => ({
      x: x(index),
      y: y(bucket.counts[group]),
      value: bucket.counts[group],
      index,
    }));
    return {
      group,
      points,
      path: smoothPath(points),
      total: points.reduce((sum, point) => sum + point.value, 0),
    };
  });

  return {
    width,
    height,
    plot,
    series,
    ticks: scale.values.map((value) => ({
      value,
      label: tickLabel(value),
      y: y(value),
    })),
    labels: calendarAxisLabels(buckets, x, span),
    columns: buckets.map((bucket, index) => ({
      index,
      x: x(index),
      firstDay: bucket.firstDay,
      lastDay: bucket.lastDay,
      label: spanLabel(bucket.firstDay, bucket.lastDay),
      counts: bucket.counts,
    })),
    orders: series.reduce((sum, line) => sum + line.total, 0),
    empty: peak === 0,
  };
}

/**
 * The window with every count at zero.
 *
 * Lets the panel draw its own axes, grid and dates before anything has been
 * counted, so the sheet behind the reveal control is the real one — only the
 * lines are missing.
 */
export function emptyTrendBuckets(
  period: OrderTrendPeriod,
  now = Date.now(),
): OrderTrendBucket[] {
  return orderTrendWindow(period, now).buckets.map((bucket) => ({
    ...bucket,
    counts: { done: 0, open: 0, new: 0, problem: 0 },
  }));
}
