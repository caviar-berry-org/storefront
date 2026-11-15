/**
 * Geometry for the channel columns, kept pure so it can be tested and previewed
 * without a database, a browser or the admin shell around it.
 *
 * The sheet is a fixed viewBox: the SVG scales to its container, so every value
 * here is in sheet units, never pixels on a particular screen.
 */
import type { ChannelShare } from "./analytics-window.ts";

export const chartSheet = { width: 560, height: 220 };
const plot = { top: 26, bottom: 168, left: 34, right: 548 };
const minColumn = 34;
const maxColumn = 64;
/** Below this the labels collide, so the sheet scrolls instead of squeezing. */
const comfortablePitch = 86;
/** Breathing room between columns when they need not fill the whole sheet. */
const naturalGap = 22;

export type ChannelColumn = {
  source: string;
  count: number;
  share: number;
  total: number;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  /** The single accent on the sheet: the channel that brought the most. */
  lead: boolean;
};

export type ChannelChartModel = {
  sheet: typeof chartSheet;
  plot: typeof plot;
  columns: ChannelColumn[];
  ticks: { value: number; y: number }[];
  average: { value: number; y: number } | null;
  /** Where the rails stop: at the data when the columns do not fill the sheet. */
  axisRight: number;
  /** Minimum width in CSS pixels before the sheet should scroll. */
  scrollWidth: number | null;
};

export function channelChartModel(
  rows: readonly ChannelShare[],
  orders: number,
): ChannelChartModel {
  const height = plot.bottom - plot.top;
  const span = plot.right - plot.left;
  const top = Math.max(1, ...rows.map((row) => row.count));
  // A whole, even ceiling keeps the midpoint tick a whole number of orders.
  const ceiling = Math.max(2, Math.ceil(top / 2) * 2);
  const y = (value: number) => plot.bottom - (value / ceiling) * height;

  const width = rows.length
    ? Math.max(minColumn, Math.min(maxColumn, span / rows.length - 14))
    : minColumn;
  const natural =
    width * rows.length + naturalGap * Math.max(0, rows.length - 1);
  // With few channels the columns keep their natural spacing and the rails stop
  // at the data, so two columns do not read as a mostly empty chart.
  const loose = natural <= span;
  const gap =
    rows.length > 1
      ? loose
        ? naturalGap
        : (span - width * rows.length) / (rows.length - 1)
      : 0;
  const average = rows.length > 1 ? orders / rows.length : null;

  return {
    sheet: chartSheet,
    plot,
    axisRight: loose
      ? Math.min(plot.right, plot.left + natural + 10)
      : plot.right,
    ticks: [0, ceiling / 2, ceiling].map((value) => ({ value, y: y(value) })),
    average: average === null ? null : { value: average, y: y(average) },
    scrollWidth:
      rows.length * comfortablePitch > chartSheet.width
        ? rows.length * comfortablePitch
        : null,
    columns: rows.map((row, index) => {
      const columnY = y(row.count);
      return {
        source: row.source,
        count: row.count,
        share: row.share,
        total: row.total,
        x: plot.left + index * (width + gap),
        y: columnY,
        width,
        height: Math.max(2, plot.bottom - columnY),
        radius: Math.min(width / 2, 7),
        lead: index === 0,
      };
    }),
  };
}
