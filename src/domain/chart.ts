/**
 * Shared geometry for staff charts.
 *
 * Nothing here knows what is being plotted. A chart module supplies buckets
 * and values; this file decides how the sheet is measured, where the grid
 * sits, how the axis is stepped and how a line is drawn. Keeping it pure
 * means every rule below is testable without a database or a browser, and the
 * next chart inherits the same reading rather than inventing its own.
 *
 * The rules, in short:
 *
 * - **Measured, never scaled.** The caller passes the container width it has
 *   actually measured. An SVG with a fixed `viewBox` and `width: 100%` grows
 *   its height with the monitor, which turns a chart into a field of nothing.
 * - **The axis makes room for its own numbers.** The left margin is computed
 *   from the widest tick, so a chart of thousands is not clipped and a chart
 *   of single digits does not waste a margin on nobody.
 * - **Round steps.** A scale steps by 1, 2, 5 or 10 × a power of ten, never by
 *   whatever the peak divided by four happened to be.
 * - **Calendar steps on the time axis.** Dates land on every nth *day*, not
 *   every nth bucket, so the same chart on a laptop and a wide monitor is
 *   stepped the same way — only sparser.
 * - **A curve may not say more than the data.** Smoothing is monotone, so a
 *   line between two values never leaves the range they bound.
 */

const dayMs = 86400000;

/** Sheet height in CSS pixels. Fixed: only the width is measured. */
export const chartHeight = 264;

const edge = { top: 16, right: 16, bottom: 30 };
/** The axis never eats more of a narrow sheet than this. */
const maxAxisShare = 0.25;
const tickFontPx = 11.5;
/** Tabular digits sit on a fixed advance; this is it, near enough to measure by. */
const digitPx = tickFontPx * 0.62;

/** Room a `10.11` label needs before its neighbour starts touching it. */
const labelPitch = 58;
/** Never more dates than this, however wide the panel gets. */
const maxAxisLabels = 10;
/**
 * Calendar steps the time axis is allowed to use. A step staff can name —
 * every fifth or tenth day — reads far better than "every third bucket,
 * because that is what fitted".
 */
const labelDaySteps = [1, 2, 5, 10, 15, 30];

const targetSteps = 5;
const stepChoices = [1, 2, 5, 10];

export type Scale = { ceiling: number; step: number; values: number[] };

/**
 * A scale staff can read: whole units, a round step, four to six lines.
 * Thirty steps by 10, a hundred by 20 — never by 6.5.
 */
export function niceScale(peak: number): Scale {
  if (peak <= 0) return { ceiling: 4, step: 1, values: [0, 1, 2, 3, 4] };
  const rough = peak / targetSteps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    (stepChoices.find((choice) => choice * magnitude >= rough) ?? 10) *
    magnitude;
  const ceiling = Math.ceil(peak / step) * step;
  const values: number[] = [];
  for (let value = 0; value <= ceiling + step / 2; value += step)
    values.push(Math.round(value));
  return { ceiling, step, values };
}

const groupedNumber = new Intl.NumberFormat("uk-UA", {
  maximumFractionDigits: 0,
});

/** Axis numbers are grouped like every other figure in the panel. */
export function tickLabel(value: number) {
  return groupedNumber.format(value);
}

export type PlotBox = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * The drawing area, with a left margin wide enough for the tick it has to
 * print. A fixed margin is the reason charts clip their own axis the first
 * time a number reaches four digits.
 */
export function plotBox(
  width: number,
  height: number,
  ticks: readonly number[],
): PlotBox {
  const widest = Math.max(1, ...ticks.map((value) => tickLabel(value).length));
  const wanted = Math.round(widest * digitPx) + 18;
  const left = Math.min(Math.round(width * maxAxisShare), Math.max(34, wanted));
  return {
    top: edge.top,
    right: Math.max(left + 40, width - edge.right),
    bottom: height - edge.bottom,
    left,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

export type Point = { x: number; y: number };

/**
 * Monotone cubic interpolation (Fritsch-Carlson).
 *
 * A plain smoothing spline overshoots: between a 0 and a 4 it would dip below
 * the axis and draw minus one. This keeps every segment inside the values it
 * connects, so the curve can only say what the data says.
 */
export function smoothPath(points: readonly Point[]) {
  if (points.length === 0) return "";
  const start = `M${round(points[0]!.x)} ${round(points[0]!.y)}`;
  if (points.length === 1) return start;
  const slopes: number[] = [];
  const tangents: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const run = points[i + 1]!.x - points[i]!.x;
    slopes.push(run === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / run);
  }
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1) {
      tangents.push(slopes[i === 0 ? 0 : slopes.length - 1]!);
      continue;
    }
    const before = slopes[i - 1]!;
    const after = slopes[i]!;
    // A turning point gets a flat tangent, which is what pins the curve down.
    if (before * after <= 0) {
      tangents.push(0);
      continue;
    }
    const average = (before + after) / 2;
    const limit = 3 * Math.min(Math.abs(before), Math.abs(after));
    tangents.push(Math.sign(average) * Math.min(Math.abs(average), limit));
  }
  let path = start;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const third = (to.x - from.x) / 3;
    path += ` C${round(from.x + third)} ${round(from.y + tangents[i]! * third)} ${round(to.x - third)} ${round(to.y - tangents[i + 1]! * third)} ${round(to.x)} ${round(to.y)}`;
  }
  return path;
}

const axisDay = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Kyiv",
});

const dayAndMonth = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Kyiv",
});

const dayOnly = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  timeZone: "Europe/Kyiv",
});

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

/** `10.11` — short enough to repeat across an axis without crowding it. */
export function axisDate(day: string) {
  return axisDay.format(asDate(day));
}

/**
 * `15 лист.`, or `18–19 вер.` when a bucket covers more than one day. Used
 * where there is room to be unambiguous — a readout, never an axis.
 */
export function spanLabel(firstDay: string, lastDay: string) {
  if (firstDay === lastDay) return dayAndMonth.format(asDate(firstDay));
  return firstDay.slice(0, 7) === lastDay.slice(0, 7)
    ? `${dayOnly.format(asDate(firstDay))}–${dayAndMonth.format(asDate(lastDay))}`
    : `${dayAndMonth.format(asDate(firstDay))} – ${dayAndMonth.format(asDate(lastDay))}`;
}

export type AxisBucket = { from: number; firstDay: string };

export type AxisLabel = { index: number; x: number; text: string };

/**
 * Dates on a calendar step.
 *
 * The last bucket is always named, because "up to today" is the half staff
 * check, and a regular label it would collide with is dropped rather than
 * printed underneath it.
 */
export function calendarAxisLabels(
  buckets: readonly AxisBucket[],
  x: (index: number) => number,
  span: number,
): AxisLabel[] {
  if (buckets.length === 0) return [];
  const last = buckets.length - 1;
  if (last === 0)
    return [{ index: 0, x: x(0), text: axisDate(buckets[0]!.firstDay) }];
  const bucketDays = Math.max(
    1,
    Math.round((buckets[1]!.from - buckets[0]!.from) / dayMs),
  );
  const totalDays = bucketDays * buckets.length;
  const fit = Math.min(
    maxAxisLabels,
    Math.max(2, Math.floor(span / labelPitch)),
  );
  const stepDays =
    labelDaySteps.find(
      (step) => step % bucketDays === 0 && Math.ceil(totalDays / step) <= fit,
    ) ?? totalDays;
  const every = Math.max(1, Math.round(stepDays / bucketDays));
  const chosen = new Set<number>([last]);
  for (let index = 0; index < last; index += every) chosen.add(index);
  return [...chosen]
    .sort((a, b) => a - b)
    .filter(
      (index, position, all) =>
        index === last ||
        all[position + 1] === undefined ||
        x(all[position + 1]!) - x(index) >= labelPitch * 0.75,
    )
    .map((index) => ({
      index,
      x: x(index),
      // The axis names the day a bucket opens; a bucket covering several days
      // spells them all out in the readout, where there is room.
      text: axisDate(buckets[index]!.firstDay),
    }));
}
