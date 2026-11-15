import assert from "node:assert/strict";
import test from "node:test";
import {
  contactLookupTerms,
  customerSearchTerm,
} from "../../src/domain/customer-directory.ts";
import {
  applyOrderChange,
  availableOrderStatuses,
  isCarrierTrackingNumber,
  normalizeTrackingNumber,
  orderCollectionPath,
  orderNumberLookupTerms,
  orderSearchTerm,
  trackingNumberLimit,
  type Order,
} from "../../src/domain/orders.ts";

const at = Date.UTC(2026, 10, 10);
const online = {
  type: "online",
  status: "new",
  payment: { method: "online", status: "pending" },
} as const;

test("opening once marks new as viewed and staff cannot restore automatic states", () => {
  const viewed = applyOrderChange(online, { action: "viewed" }, at);
  assert.equal(viewed?.status, "viewed");
  const processing = { ...online, status: "processing" } as const;
  for (const status of ["new", "viewed", "packed"] as const)
    assert.equal(
      applyOrderChange(processing, { action: "status", status }, at),
      null,
    );
  assert.equal(applyOrderChange(processing, { action: "viewed" }, at), null);
});

test("staff can confirm a pending transfer once, never an online payment", () => {
  const transfer = {
    type: "corporate",
    status: "awaitingPayment",
    payment: { method: "iban", status: "pending" },
  } as const;
  const confirmed = applyOrderChange(transfer, { action: "payment" }, at);
  assert.deepEqual(confirmed, {
    status: "processing",
    payment: { method: "iban", status: "paid", paidAt: at },
  });
  assert.equal(
    applyOrderChange({ ...transfer, ...confirmed }, { action: "payment" }, at),
    null,
  );
  assert.equal(
    applyOrderChange(
      { ...transfer, type: "online" },
      { action: "payment" },
      at,
    ),
    null,
  );
  assert.equal(
    applyOrderChange(
      { ...online, status: "viewed" },
      { action: "payment" },
      at,
    ),
    null,
  );
});

test("fulfillment respects payment, and neither packing nor a TTN gates it", () => {
  const paid: Pick<Order, "type" | "status" | "payment"> = {
    ...online,
    status: "processing",
    payment: { method: "online", status: "paid" },
  };
  // Packing can be skipped entirely: "shipped" is offered straight from work.
  assert.deepEqual(availableOrderStatuses(paid), [
    "packed",
    "shipped",
    "cancelled",
  ]);
  assert.deepEqual(availableOrderStatuses({ ...paid, status: "packed" }), [
    "shipped",
    "processing",
    "cancelled",
  ]);
  assert.deepEqual(availableOrderStatuses({ ...online, status: "packed" }), [
    "processing",
  ]);
  // A tracking number changes nothing — with or without one the step is offered.
  for (const trackingNumber of [undefined, "20450000000000", "manual-7"])
    assert.deepEqual(
      availableOrderStatuses({
        ...paid,
        status: "packed",
        delivery: {
          method: "branch",
          city: "Київ",
          destination: "1",
          ...(trackingNumber && { trackingNumber }),
        },
      }),
      ["shipped", "processing", "cancelled"],
    );
  const shipped = { ...paid, status: "shipped" } as const;
  assert.deepEqual(
    availableOrderStatuses({
      ...shipped,
      delivery: { method: "branch", city: "Київ", destination: "1" },
    }),
    ["atBranch", "received"],
  );
  assert.deepEqual(availableOrderStatuses(shipped), ["received"]);
  assert.deepEqual(availableOrderStatuses({ ...paid, status: "received" }), [
    "dispute",
  ]);
  assert.deepEqual(availableOrderStatuses({ ...paid, status: "dispute" }), [
    "received",
  ]);
  // An unpaid order still cannot be fulfilled; money stays the only gate.
  assert.ok(
    !availableOrderStatuses({ ...online, status: "processing" }).some(
      (status) => status === "packed" || status === "shipped",
    ),
  );
});

test("an order reaches completion with packing skipped and no tracking number", () => {
  let state: Pick<Order, "type" | "status" | "payment"> = {
    type: "iban",
    status: "new",
    payment: { method: "iban", status: "pending" },
  };
  const step = (next: Order["status"]) => {
    const applied = applyOrderChange(
      state,
      { action: "status", status: next },
      at,
    );
    assert.ok(applied, `blocked at ${state.status} -> ${next}`);
    state = { ...state, ...applied };
  };
  state = { ...state, ...applyOrderChange(state, { action: "viewed" }, at)! };
  step("processing");
  state = { ...state, ...applyOrderChange(state, { action: "payment" }, at)! };
  assert.equal(state.payment.status, "paid");
  step("shipped");
  step("received");
  assert.equal(state.status, "received");
});

test("tracking numbers are free-form but bounded, and only waybills are checkable", () => {
  assert.equal(normalizeTrackingNumber("  20450000000000 "), "20450000000000");
  assert.equal(normalizeTrackingNumber("ЕН 123-456"), "ЕН 123-456");
  // "/" would split a Firestore notification document path.
  assert.equal(normalizeTrackingNumber("ЕН 123/456"), null);
  assert.equal(normalizeTrackingNumber("  parcel   7 "), "parcel 7");
  assert.equal(normalizeTrackingNumber("   "), "");
  assert.equal(normalizeTrackingNumber("<script>"), null);
  assert.equal(normalizeTrackingNumber("-leading"), null);
  assert.equal(
    normalizeTrackingNumber("a".repeat(trackingNumberLimit)),
    "a".repeat(trackingNumberLimit),
  );
  assert.equal(
    normalizeTrackingNumber("a".repeat(trackingNumberLimit + 1)),
    null,
  );
  assert.equal(normalizeTrackingNumber(20450000000000), null);
  assert.ok(isCarrierTrackingNumber("2045 0000 0000 00"));
  assert.ok(!isCarrierTrackingNumber("manual-7"));
  assert.ok(!isCarrierTrackingNumber("204500000000000"));
});

test("order search uses the same contact terms as the customer directory", () => {
  const terms = contactLookupTerms({
    email: "User@Example.com",
    phone: "+380 (67) 123-45-67",
  });
  for (const input of [
    " USER@example.com ",
    "0671",
    "123-45",
    "+380 67 123 45 67",
  ])
    assert.ok(terms.includes(customerSearchTerm(input)!));
  assert.equal(customerSearchTerm("123"), null);
  assert.notEqual(
    orderCollectionPath("development"),
    orderCollectionPath("production"),
  );
  assert.throws(() => orderCollectionPath(undefined));
});

test("an order is findable by its printed number without hijacking contact search", () => {
  const number = "CB-20261113-1507103D";
  const keys = orderNumberLookupTerms(number);
  assert.deepEqual(keys, ["number:cb-20261113-1507103d", "number:1507103d"]);
  // Whole, pasted from the letter — and by the tail staff read out loud.
  assert.ok(keys.includes(orderSearchTerm(number) as string));
  assert.ok(keys.includes(orderSearchTerm(" 1507103D ") as string));
  // Contact rules keep precedence, so a phone query stays a phone query.
  assert.equal(orderSearchTerm("0671234567"), "phone:0671234567");
  assert.equal(orderSearchTerm("name@example.com"), "email:name@example.com");
  assert.equal(orderSearchTerm(""), "");
  assert.equal(orderSearchTerm("ab"), null);
  assert.equal(orderSearchTerm("drop table orders"), null);
});
