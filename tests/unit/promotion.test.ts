import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizePromotionCode,
  promotionHeldUntil,
  promotionTotals,
  promotionUsable,
} from "../../src/domain/promotion.ts";

test("normalizes promotion codes and rounds the discount in minor units", () => {
  assert.equal(normalizePromotionCode("  ucb10  "), "UCB10");
  for (const invalid of ["", "UCB 10", "промо", "X".repeat(41), 10])
    assert.equal(normalizePromotionCode(invalid), null);

  const promotion = { code: "UCB10", percent: 10 };
  assert.deepEqual(promotionTotals(106, promotion), {
    discountMinor: 11,
    totalMinor: 95,
  });
  assert.deepEqual(promotionTotals(0, promotion), {
    discountMinor: 0,
    totalMinor: 0,
  });
  assert.deepEqual(promotionTotals(106, null), {
    discountMinor: 0,
    totalMinor: 106,
  });
});

test("an abandoned payment gives the code back, a live one still holds it", () => {
  const now = 1_800_000_000_000;
  const live = { expiresAt: now + 86_400_000, percent: 10 };

  // Nothing claimed it.
  assert.equal(promotionHeldUntil(live, now), null);
  assert.equal(promotionUsable(live, now), true);

  // An online order holds it only while its invoice can still be paid.
  const held = { ...live, reservedBy: "order-1", reservedUntil: now + 600_000 };
  assert.equal(promotionHeldUntil(held, now), now + 600_000);
  assert.equal(promotionUsable(held, now), false);

  // The order that placed the hold is never blocked by its own hold, so a buyer
  // returning to the same unpaid order can still pay it.
  assert.equal(promotionHeldUntil(held, now, "order-1"), null);
  assert.equal(promotionUsable(held, now, "order-1"), true);

  // The buyer closed the payment page: once the invoice lapses, so does the hold.
  const lapsed = now + 600_001;
  assert.equal(promotionHeldUntil(held, lapsed), null);
  assert.equal(
    promotionUsable(
      {
        ...live,
        expiresAt: lapsed + 86_400_000,
        reservedBy: "order-1",
        reservedUntil: now + 600_000,
      },
      lapsed,
    ),
    true,
    "a lapsed hold must not outlive the invoice it protected",
  );

  // A hold with no deadline fails closed. This guards money: a writer that
  // forgets the deadline must never hand the same discount to two orders.
  // Staff release such a code by cancelling the order that holds it.
  const undated = { ...live, reservedBy: "order-old" };
  assert.equal(promotionHeldUntil(undated, now), Number.MAX_SAFE_INTEGER);
  assert.equal(promotionUsable(undated, now), false);
  // ...and the order holding it is still not blocked by its own hold.
  assert.equal(promotionUsable(undated, now, "order-old"), true);

  // Spending is final: a consumed code never comes back, hold or no hold.
  assert.equal(promotionUsable({ ...live, consumedBy: "order-2" }, now), false);
  assert.equal(
    promotionUsable({ ...live, consumedBy: "order-2" }, now, "order-2"),
    false,
    "the order that spent the code must not be able to spend it twice",
  );

  // An expired code stays expired whatever its hold says.
  assert.equal(promotionUsable({ ...live, expiresAt: now - 1 }, now), false);
});
