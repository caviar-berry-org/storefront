/**
 * Reporting windows for the staff dashboard.
 *
 * Every window is a whole number of Kyiv days ending with today, so a report
 * opened twice in one afternoon covers the same days both times and the label
 * can name exact dates. Boundaries are snapped to Kyiv midnight rather than
 * "now minus N days": a rolling millisecond boundary would make the cache key
 * and the data disagree, and the stated range would not match what was counted.
 */
export const analyticsPeriods = ["week", "month", "year"] as const;

export type AnalyticsPeriod = (typeof analyticsPeriods)[number];

export const isAnalyticsPeriod = (value: unknown): value is AnalyticsPeriod =>
  analyticsPeriods.some((period) => period === value);

/** Days counted by each window, today included. */
export const analyticsPeriodDays: Record<AnalyticsPeriod, number> = {
  week: 7,
  month: 30,
  year: 365,
};

const dayMs = 86400000;

/** Kyiv's UTC offset in minutes at a given instant, DST included. */
export function kyivOffsetMinutes(at: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** Epoch milliseconds of 00:00 Kyiv on a `YYYY-MM-DD` day. */
export function kyivDayStart(day: string) {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) throw new Error(`Invalid day: ${day}`);
  // Kyiv switches DST at 03:00/04:00 local, so the offset at 00:00 UTC on a day
  // is always the offset that day's local midnight had.
  return utcMidnight - kyivOffsetMinutes(utcMidnight) * 60000;
}

export function kyivDay(at: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export type AnalyticsWindow = {
  period: AnalyticsPeriod;
  /** Inclusive lower bound, epoch ms. */
  from: number;
  /** Exclusive upper bound: the start of tomorrow in Kyiv. */
  to: number;
  /** `YYYY-MM-DD`, inclusive. */
  firstDay: string;
  lastDay: string;
  days: number;
};

export function analyticsWindow(
  period: AnalyticsPeriod,
  now = Date.now(),
): AnalyticsWindow {
  const days = analyticsPeriodDays[period];
  const lastDay = kyivDay(now);
  const todayStart = kyivDayStart(lastDay);
  const firstDay = kyivDay(todayStart - (days - 1) * dayMs);
  return {
    period,
    from: kyivDayStart(firstDay),
    to: kyivDayStart(kyivDay(todayStart + dayMs)),
    firstDay,
    lastDay,
    days,
  };
}

/** `total` is money received, not money ordered. */
export type ChannelRow = { source: string; count: number; total: number };

export type ChannelShare = ChannelRow & { share: number };

/**
 * Orders per channel as a share of the period, largest first. The shares are
 * rounded independently and need not add up to exactly 100 — a forced total
 * would mean showing at least one channel a number it did not earn.
 */
export function channelShares(rows: readonly ChannelRow[]): {
  rows: ChannelShare[];
  orders: number;
  revenue: number;
} {
  const counted = rows.filter((row) => row.count > 0);
  const orders = counted.reduce((sum, row) => sum + row.count, 0);
  const revenue = counted.reduce((sum, row) => sum + row.total, 0);
  return {
    orders,
    revenue,
    rows: [...counted]
      .sort((a, b) => b.count - a.count || b.total - a.total)
      .map((row) => ({
        ...row,
        share: orders ? Math.round((row.count / orders) * 1000) / 10 : 0,
      })),
  };
}
