import assert from "node:assert/strict";
import test from "node:test";
import {
  axisDate,
  calendarAxisLabels,
  chartHeight,
  niceScale,
  plotBox,
  smoothPath,
  spanLabel,
  tickLabel,
} from "../../src/domain/chart.ts";

test("the scale steps in round numbers staff can read", () => {
  assert.deepEqual(niceScale(0), {
    ceiling: 4,
    step: 1,
    values: [0, 1, 2, 3, 4],
  });
  // Eleven orders at a point: step 5, not 2.2.
  assert.deepEqual(niceScale(11).values, [0, 5, 10, 15]);
  assert.deepEqual(niceScale(30).values, [0, 10, 20, 30]);
  assert.deepEqual(niceScale(100).values, [0, 20, 40, 60, 80, 100]);
  for (const peak of [1, 3, 7, 12, 48, 99, 250, 1234]) {
    const scale = niceScale(peak);
    assert.ok(scale.ceiling >= peak, `${peak} does not fit under its ceiling`);
    assert.ok(scale.values.length >= 3 && scale.values.length <= 8, `${peak}`);
    for (const value of scale.values)
      assert.equal(Number.isInteger(value), true, `${peak} → ${value}`);
  }
});

test("a smoothed line never leaves the range of the values it connects", () => {
  // The case a plain spline gets wrong: a spike between two zeroes would
  // overshoot below the axis and draw a negative order count.
  const points = [0, 0, 7, 0, 2, 0].map((value, index) => ({
    x: index * 100,
    y: 200 - value * 20,
  }));
  const numbers = (smoothPath(points).match(/-?\d+(?:\.\d+)?/g) ?? []).map(
    Number,
  );
  const ys = numbers.filter((_, index) => index % 2 === 1);
  const low = Math.min(...points.map((point) => point.y));
  const high = Math.max(...points.map((point) => point.y));
  for (const y of ys) {
    assert.ok(y >= low - 0.01, `control point ${y} rises above the data`);
    assert.ok(y <= high + 0.01, `control point ${y} dips below the data`);
  }
});

test("the axis margin grows with the numbers it has to print", () => {
  const narrow = plotBox(900, chartHeight, niceScale(8).values);
  const wide = plotBox(900, chartHeight, niceScale(250000).values);
  assert.ok(
    wide.left > narrow.left,
    "a six-figure axis gets no more room than a single-digit one",
  );
  // The widest tick still fits in the margin reserved for it.
  const widest = Math.max(
    ...niceScale(250000).values.map((value) => tickLabel(value).length),
  );
  assert.ok(wide.left >= widest * 7, `${wide.left} is too tight for ${widest}`);
  // …and the axis never swallows a narrow sheet.
  const phone = plotBox(320, chartHeight, niceScale(250000).values);
  assert.ok(phone.left <= 80, `${phone.left} eats a 320px sheet`);
  assert.ok(phone.right > phone.left, "no drawing area left");
});

test("axis numbers are grouped, and a span names both of its days", () => {
  assert.equal(tickLabel(1200).replace(/\s/g, " "), "1 200");
  assert.equal(tickLabel(8), "8");
  assert.equal(axisDate("2026-09-05"), "05.09");
  assert.equal(spanLabel("2026-11-15", "2026-11-15"), "15 лист.");
  assert.match(spanLabel("2026-09-18", "2026-09-19"), /18–19/);
  // Across a month boundary both months are spelled out.
  assert.match(spanLabel("2026-09-30", "2026-10-01"), /30 вер\. – 1 жовт\./);
});

test("a single bucket still gets a date, and an empty one gets nothing", () => {
  const one = [{ from: 0, firstDay: "2026-03-01" }];
  assert.deepEqual(
    calendarAxisLabels(one, () => 100, 800).map((label) => label.text),
    ["01.03"],
  );
  assert.deepEqual(
    calendarAxisLabels([], () => 0, 800),
    [],
  );
});
