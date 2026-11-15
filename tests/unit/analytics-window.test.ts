import assert from "node:assert/strict";
import test from "node:test";
import {
  analyticsWindow,
  channelShares,
  isAnalyticsPeriod,
  kyivDay,
  kyivDayStart,
  kyivOffsetMinutes,
} from "../../src/domain/analytics-window.ts";
import { channelChartModel } from "../../src/domain/channel-chart.ts";

test("Kyiv day boundaries follow the zone's own clock, summer and winter", () => {
  // Winter: UTC+2. Summer: UTC+3.
  assert.equal(kyivOffsetMinutes(Date.UTC(2026, 0, 15, 12)), 120);
  assert.equal(kyivOffsetMinutes(Date.UTC(2026, 6, 15, 12)), 180);
  // Midnight in Kyiv is 22:00 UTC the day before in winter, 21:00 in summer.
  assert.equal(kyivDayStart("2026-01-15"), Date.UTC(2026, 0, 14, 22));
  assert.equal(kyivDayStart("2026-07-15"), Date.UTC(2026, 6, 14, 21));
  // The boundary belongs to the day it opens, not the one before it.
  assert.equal(kyivDay(kyivDayStart("2026-07-15")), "2026-07-15");
  assert.equal(kyivDay(kyivDayStart("2026-07-15") - 1), "2026-07-14");
});

test("a window covers whole Kyiv days ending today, and says which ones", () => {
  // 14 November 2026, 10:10 Kyiv.
  const now = Date.UTC(2026, 10, 14, 8, 10);
  const week = analyticsWindow("week", now);
  assert.equal(week.days, 7);
  assert.equal(week.firstDay, "2026-11-08");
  assert.equal(week.lastDay, "2026-11-14");
  // Seven days inclusive, so the bounds are exactly seven midnights apart.
  assert.equal((week.to - week.from) / 86400000, 7);
  // Today's orders are inside the window; tomorrow's are not.
  assert.ok(now >= week.from && now < week.to);
  assert.equal(analyticsWindow("month", now).firstDay, "2026-10-16");
  assert.equal(analyticsWindow("year", now).firstDay, "2025-11-15");
  // The window must not move between two reads inside the same Kyiv day.
  assert.deepEqual(
    analyticsWindow("week", Date.UTC(2026, 10, 14, 21, 59)),
    week,
  );
});

test("only the three known periods are accepted", () => {
  assert.ok(isAnalyticsPeriod("week"));
  assert.ok(!isAnalyticsPeriod("decade"));
  assert.ok(!isAnalyticsPeriod(undefined));
});

test("channel shares drop empty channels, rank by orders and never invent a total", () => {
  const { rows, orders, revenue } = channelShares([
    { source: "google", count: 2, total: 40000 },
    { source: "instagram", count: 5, total: 90000 },
    { source: "tiktok", count: 0, total: 0 },
    { source: "telegram", count: 2, total: 60000 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.source),
    // Equal counts fall back to revenue, so the ranking is never arbitrary.
    ["instagram", "telegram", "google"],
  );
  assert.equal(orders, 9);
  assert.equal(revenue, 190000);
  assert.equal(rows[0]!.share, 55.6);
  // Independent rounding may not reach exactly 100; forcing it would show a
  // channel a number it did not earn.
  assert.ok(
    Math.abs(rows.reduce((sum, row) => sum + row.share, 0) - 100) < 0.2,
  );
  assert.deepEqual(channelShares([]), { rows: [], orders: 0, revenue: 0 });
});

test("columns are drawn to scale, and the rails stop at the data", () => {
  const { rows, orders } = channelShares([
    { source: "instagram", count: 9, total: 2460000 },
    { source: "google", count: 3, total: 1310000 },
  ]);
  const model = channelChartModel(rows, orders);
  const [lead, second] = model.columns;
  // Heights follow the counts, not the ranking: three times the orders is three
  // times the column.
  assert.ok(Math.abs(lead!.height / second!.height - 3) < 0.02);
  assert.equal(lead!.lead, true);
  assert.equal(second!.lead, false);
  // Every column sits on the baseline and inside the sheet.
  for (const column of model.columns) {
    assert.ok(Math.abs(column.y + column.height - model.plot.bottom) < 0.01);
    assert.ok(column.x >= model.plot.left);
    assert.ok(column.x + column.width <= model.plot.right);
  }
  // The axis is capped by the top tick, and the average sits between the two.
  assert.equal(model.ticks.at(-1)!.value, 10);
  assert.ok(model.average!.y > lead!.y && model.average!.y < second!.y);
  // Two columns must not read as a mostly empty chart.
  assert.ok(model.axisRight < model.plot.right);
  assert.equal(model.scrollWidth, null);

  // A full set of channels scrolls rather than squeezing its labels.
  const many = channelShares(
    Array.from({ length: 12 }, (_, index) => ({
      source: `s${index}`,
      count: 12 - index,
      total: 1000,
    })),
  );
  const wide = channelChartModel(many.rows, many.orders);
  assert.ok(wide.scrollWidth && wide.scrollWidth > wide.sheet.width);
  assert.equal(wide.axisRight, wide.plot.right);
});
