import assert from "node:assert/strict";
import test from "node:test";
import {
  addKyivDays,
  groupOrderCounts,
  orderGroups,
  orderTrendModel,
  orderTrendWindow,
  openGroupStatuses,
  countedGroupStatuses,
  type OrderTrendBucket,
} from "../../src/domain/order-metrics.ts";
import { kyivDayStart } from "../../src/domain/analytics-window.ts";
import { orderStatuses } from "../../src/domain/orders.ts";

test("a dispute is counted as a problem, and an unknown status stays in work", () => {
  const counts = groupOrderCounts(100, {
    new: 10,
    received: 60,
    cancelled: 5,
    dispute: 3,
  });
  assert.deepEqual(counts, { done: 60, open: 22, new: 10, problem: 8 });
  // The four groups always add up to the total they were given.
  assert.equal(
    orderGroups.reduce((sum, group) => sum + counts[group], 0),
    100,
  );
  // A status nobody queried is work in progress, never a silent disappearance.
  assert.equal(
    groupOrderCounts(5, { new: 0, received: 0, cancelled: 0, dispute: 0 }).open,
    5,
  );
  // Counts that cannot be true must not produce a negative line.
  assert.equal(
    groupOrderCounts(1, { new: 4, received: 4, cancelled: 0, dispute: 0 }).open,
    0,
  );
});

test("every order status belongs to exactly one group", () => {
  const counted = Object.values(countedGroupStatuses).flat();
  const placed = [...counted, ...openGroupStatuses];
  for (const status of orderStatuses)
    assert.equal(
      placed.filter((name) => name === status).length,
      1,
      `${status} is not in exactly one group`,
    );
  assert.equal(placed.length, orderStatuses.length);
});

test("a window is whole Kyiv days, contiguous, ending with today", () => {
  // Noon in Kyiv on an ordinary day.
  const now = Date.parse("2026-03-10T10:00:00Z");
  for (const [period, buckets, perBucket] of [
    ["week", 7, 1],
    ["month", 30, 1],
    ["sixty", 30, 2],
  ] as const) {
    const window = orderTrendWindow(period, now);
    assert.equal(window.buckets.length, buckets, period);
    assert.equal(window.lastDay, "2026-03-10", period);
    assert.equal(window.buckets[0]!.from, window.from, period);
    assert.equal(window.buckets.at(-1)!.to, window.to, period);
    for (const [index, bucket] of window.buckets.entries()) {
      const next = window.buckets[index + 1];
      if (next) assert.equal(bucket.to, next.from, `${period} gap at ${index}`);
      assert.equal(
        (bucket.to - bucket.from) / 86400000,
        perBucket,
        `${period} bucket ${index}`,
      );
    }
  }
});

test("buckets survive the Kyiv daylight-saving switch", () => {
  // Kyiv moves its clocks back on 25 October 2026.
  const window = orderTrendWindow("week", Date.parse("2026-10-27T10:00:00Z"));
  assert.equal(window.firstDay, "2026-10-21");
  assert.equal(window.lastDay, "2026-10-27");
  assert.equal(window.buckets.length, 7);
  const hours = window.buckets.map(
    (bucket) => (bucket.to - bucket.from) / 3600000,
  );
  // Six ordinary days and the one that gained an hour — never a 23-hour day,
  // which is what a plain "now minus N × 86400000" would have produced.
  assert.deepEqual(hours, [24, 24, 24, 24, 25, 24, 24]);
  assert.equal(
    window.buckets.reduce((sum, bucket) => sum + bucket.to - bucket.from, 0),
    window.to - window.from,
  );
});

const bucketsOf = (counts: number[][]): OrderTrendBucket[] =>
  counts.map((row, index) => {
    const day = addKyivDays("2026-03-01", index);
    return {
      from: kyivDayStart(day),
      to: kyivDayStart(addKyivDays(day, 1)),
      firstDay: day,
      lastDay: day,
      counts: { done: row[0]!, open: row[1]!, new: row[2]!, problem: row[3]! },
    };
  });

test("the sheet carries one line per group and names its last bucket", () => {
  const model = orderTrendModel(
    bucketsOf([
      [0, 3, 2, 0],
      [1, 2, 1, 1],
      [4, 1, 0, 0],
    ]),
    900,
  );
  assert.equal(model.series.length, orderGroups.length);
  assert.deepEqual(
    model.series.map((line) => line.group),
    [...orderGroups],
  );
  for (const line of model.series) {
    assert.equal(line.points.length, 3);
    assert.equal(line.path.startsWith("M"), true);
    // Smooth, not angular: every segment is a cubic.
    assert.equal(line.path.split("C").length, 3);
  }
  assert.equal(model.series[0]!.total, 5);
  assert.equal(model.orders, 15);
  assert.equal(model.empty, false);
  // The axis always names both ends of the range it covers.
  assert.equal(model.labels[0]!.index, 0);
  assert.equal(model.labels.at(-1)!.index, 2);
  // The baseline is a real zero, and the top tick clears the tallest point.
  assert.equal(model.ticks[0]!.value, 0);
  assert.ok(model.ticks.at(-1)!.value >= 4);
});

test("a window with no orders is reported as empty rather than drawn flat", () => {
  const model = orderTrendModel(
    bucketsOf([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]),
    900,
  );
  assert.equal(model.empty, true);
  assert.equal(model.orders, 0);
  // Even empty, the sheet keeps a sane scale instead of dividing by zero.
  assert.equal(model.ticks[0]!.y, model.plot.bottom);
  for (const line of model.series)
    for (const point of line.points) assert.equal(point.y, model.plot.bottom);
});

test("the axis steps in calendar days and never prints two dates on one spot", () => {
  const buckets = bucketsOf(Array.from({ length: 30 }, () => [0, 1, 0, 0]));
  for (const width of [380, 720, 1400, 1900]) {
    const model = orderTrendModel(buckets, width);
    assert.equal(model.labels[0]!.index, 0, `${width}`);
    assert.equal(model.labels.at(-1)!.index, 29, `${width}`);
    assert.ok(model.labels.length <= 10, `${width} prints too many dates`);
    // Every date is numeric and short, never a bucket range.
    for (const label of model.labels)
      assert.match(label.text, /^\d{2}\.\d{2}$/, `${width}`);
    // The regular labels sit on one calendar step; only the final one may
    // fall off it, and then only if it still clears its neighbour.
    const steps = new Set(
      model.labels
        .slice(0, -1)
        .map((label, index, all) =>
          index ? label.index - all[index - 1]!.index : null,
        )
        .filter((step): step is number => step !== null),
    );
    assert.ok(steps.size <= 1, `${width} mixes steps: ${[...steps].join()}`);
    for (const [index, label] of model.labels.entries()) {
      const next = model.labels[index + 1];
      if (next)
        assert.ok(
          next.x - label.x >= 40,
          `labels ${label.index} and ${next.index} collide at ${width}px`,
        );
    }
  }
});

test("a sixty-day window is stepped by ten days, not by bucket", () => {
  // Thirty buckets of two days each, the shape the sixty-day window has.
  const paired = Array.from({ length: 30 }, (_, index) => ({
    from: kyivDayStart(addKyivDays("2026-09-18", index * 2)),
    to: kyivDayStart(addKyivDays("2026-09-18", index * 2 + 2)),
    firstDay: addKyivDays("2026-09-18", index * 2),
    lastDay: addKyivDays("2026-09-18", index * 2 + 1),
    counts: { done: 0, open: 1, new: 0, problem: 0 },
  }));
  const model = orderTrendModel(paired, 1400);
  // Every ten days is every fifth bucket.
  assert.deepEqual(
    model.labels.map((label) => label.index),
    [0, 5, 10, 15, 20, 25, 29],
  );
  assert.equal(model.labels[0]!.text, "18.09");
  assert.equal(model.labels[1]!.text, "28.09");
  // The axis names the day a bucket opens, so the last pair reads 15.11 and
  // covers 15–16; the range line above the chart is what names 16.11.
  assert.equal(model.labels.at(-1)!.text, "15.11");
  assert.equal(model.columns.at(-1)!.lastDay, "2026-11-16");
});
