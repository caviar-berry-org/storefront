import assert from "node:assert/strict";
import test from "node:test";
import {
  contactIdentity,
  unpaidCapacity,
  unpaidLimits,
  unpaidOutstanding,
} from "../../src/domain/checkout-limits.ts";

test("one mailbox counts once however it is spelled", () => {
  for (const spelling of [
    "anna.k@gmail.com",
    "AnnaK@Gmail.com",
    "a.n.n.a.k+promo@gmail.com",
    "annak@googlemail.com",
  ])
    assert.equal(contactIdentity(spelling), "annak@gmail.com");
  // Dots are significant outside Gmail; only the +tag is dropped.
  assert.equal(contactIdentity("anna.k+x@ukr.net"), "anna.k@ukr.net");
  assert.notEqual(
    contactIdentity("anna.k@ukr.net"),
    contactIdentity("annak@ukr.net"),
  );
  // A local part that is nothing but a tag keeps its original spelling.
  assert.equal(contactIdentity("+tag@example.com"), "+tag@example.com");
});

test("outstanding unpaid orders skip cancelled ones and tolerate bad totals", () => {
  assert.deepEqual(
    unpaidOutstanding([
      { status: "new", totalMinor: 1000 },
      { status: "processing", totalMinor: 2500 },
      { status: "cancelled", totalMinor: 9999 },
      { status: "new", totalMinor: "oops" },
    ]),
    { orders: 3, totalMinor: 3500 },
  );
});

test("capacity admits an order that lands exactly on a limit and refuses one past it", () => {
  const { outstandingOrders: orders, outstandingMinor: total } = unpaidLimits;
  assert.ok(unpaidCapacity({ orders: orders - 1, totalMinor: 0 }, 1));
  assert.ok(!unpaidCapacity({ orders, totalMinor: 0 }, 1));
  assert.ok(unpaidCapacity({ orders: 0, totalMinor: total - 100 }, 100));
  assert.ok(!unpaidCapacity({ orders: 0, totalMinor: total - 100 }, 101));
});
