import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { randomUUID, generateKeyPairSync, createSign } from "node:crypto";
import { memoryFirestore } from "../helpers/firestore.ts";
import { serverModule } from "../helpers/server-module.ts";
import { initialCaviar } from "../../src/lib/catalog-fixtures.ts";
import { productView } from "../../src/domain/managed-catalog.ts";
import { catalogCollections } from "../../src/lib/catalog-collections.ts";
import {
  reserveStock,
  consumeStock,
  releaseStock,
} from "../../src/domain/checkout-stock.ts";
import {
  paymentTransition,
  verifyMonoSignature,
  type MonoInvoice,
} from "../../src/domain/payment.ts";
import {
  promotionCampaign,
  promotionEligibleSubtotal,
  promotionTotals,
  promotionUsable,
} from "../../src/domain/promotion.ts";
import type { Order } from "../../src/domain/orders.ts";

function fixture() {
  process.env.APP_ENV = "development";
  process.env.FIREBASE_PROJECT_ID = "caviar-berry-dev";
  process.env.CATALOG_SOURCE = "firestore";
  process.env.CHECKOUT_ENABLED = "true";
  const memory = memoryFirestore();
  const record = structuredClone(
    initialCaviar().find((row) => row.id === "premium")!,
  );
  record.data.copy.ua.variants[0]!.priceMinor = 10000;
  record.data.copy.en.variants[0]!.priceMinor = 10000;
  const pack = record.data.copy.ua.variants[0]!;
  pack.available = true;
  record.data.copy.en.variants[0]!.available = true;
  record.data.stock[pack.id] = {
    quantity: 2,
    reserved: 0,
    batches: [{ code: "TEST", expiresOn: "2099-12-31", quantity: 2 }],
  };
  memory.rows.set(
    `${catalogCollections.caviar.records}/${record.id}`,
    record as unknown as Record<string, unknown>,
  );
  const product = productView(record.data, "ua", "2026-11-11", true);
  let invoices = 0;
  let failInvoice = false;
  const mocks = {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => memory.db,
    },
    [resolve("src/lib/server/catalog/storefront.ts")]: {
      freshCaviar: async () => [product],
    },
    [resolve("src/lib/server/delivery/nova-poshta.ts")]: {
      resolveDelivery: async () => ({
        city: "Київ",
        cityRef: "city",
        branchRef: "branch",
        destination: "Відділення 1",
      }),
    },
    [resolve("src/lib/server/payments/mono.ts")]: {
      assertMonoReady: () => {},
      createMonoInvoice: async () => {
        invoices++;
        if (failInvoice) throw new Error("Unknown acceptance.");
        return {
          invoiceId: "invoice_test",
          pageUrl: "https://pay.monobank.ua/test",
        };
      },
      monoInvoiceStatus: async () => ({}),
    },
    "firebase-admin/firestore": {
      FieldValue: { delete: () => ({ __delete: true }) },
    },
  };
  const creation = serverModule<
    typeof import("../../src/lib/server/checkout/create-order.ts")
  >("src/lib/server/checkout/create-order.ts", mocks);
  const payment = serverModule<
    typeof import("../../src/lib/server/checkout/payment.ts")
  >("src/lib/server/checkout/payment.ts", mocks);
  const input = {
    contact: {
      name: "Test Customer",
      phone: "+380991234567",
      email: "test@example.com",
      city: "Київ",
      address: "1",
      delivery: "branch" as const,
      payment: "online" as const,
      consent: true,
      comment: "",
    },
    items: [{ variantId: pack.id, quantity: 1 }],
    locale: "ua" as const,
    expectedSubtotalMinor: 10000,
    expectedTotalMinor: 10000,
  };
  return {
    ...memory,
    record,
    pack,
    product,
    creation,
    payment,
    input,
    invoices: () => invoices,
    failInvoice: () => {
      failInvoice = true;
    },
  };
}
const success = (
  order: Order,
  status: MonoInvoice["status"] = "success",
  modifiedDate = "2026-11-11T20:00:00Z",
): MonoInvoice => ({
  invoiceId: "invoice_test",
  reference: order.id,
  amount: order.totalMinor,
  ccy: 980,
  status,
  modifiedDate,
});

test("checkout commits one order/customer/reservation; identical retries bypass unavailable stock and conflicting bodies fail", async () => {
  const f = fixture();
  const key = randomUUID();
  const order = await f.creation.createOrder(f.input, key, "test");
  assert.equal(order.inventoryState, "reserved");
  assert.equal(
    f.rows.get(`${catalogCollections.caviar.records}/premium`)?.revision,
    f.record.revision + 1,
  );
  const retry = await f.creation.createOrder(f.input, key, "test");
  assert.equal(retry.id, order.id);
  assert.equal(
    [...f.rows.keys()].filter((path) =>
      /^orderBooks\/development\/orders\/[^/]+$/.test(path),
    ).length,
    1,
  );
  assert.equal(
    [...f.rows.values()].find((row) => row.orderCount)?.orderCount,
    1,
  );
  await assert.rejects(
    f.creation.createOrder(
      { ...f.input, contact: { ...f.input.contact, name: "Another Person" } },
      key,
      "test",
    ),
    /CONFLICT/,
  );
});
test("last-unit competition has one winner; stale prices and failed commits create no partial order", async () => {
  const f = fixture();
  const record = f.rows.get(
    `${catalogCollections.caviar.records}/premium`,
  )! as unknown as typeof f.record;
  record.data.stock[f.pack.id]!.quantity = 1;
  record.data.stock[f.pack.id]!.batches = [];
  const results = await Promise.allSettled([
    f.creation.createOrder(f.input, randomUUID(), "test"),
    f.creation.createOrder(f.input, randomUUID(), "test"),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const g = fixture();
  await assert.rejects(
    g.creation.createOrder(
      { ...g.input, expectedTotalMinor: 1 },
      randomUUID(),
      "test",
    ),
    /STOCK/,
  );
  assert.equal(
    [...g.rows.keys()].some((path) => path.startsWith("orderBooks/")),
    false,
  );
  g.unavailable();
  await assert.rejects(g.creation.createOrder(g.input, randomUUID(), "test"));
  assert.equal(
    [...g.rows.keys()].some((path) => path.startsWith("orderBooks/")),
    false,
  );
});
test("invoice claim prevents parallel duplicates and never recreates an ambiguously accepted invoice", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(f.input, randomUUID(), "test");
  await Promise.all([
    f.payment.ensureInvoice(order),
    f.payment.ensureInvoice(order),
  ]);
  assert.equal(f.invoices(), 1);
  const g = fixture();
  const other = await g.creation.createOrder(g.input, randomUUID(), "test");
  g.failInvoice();
  await g.payment.ensureInvoice(other);
  const pending = await g.payment.ensureInvoice(other);
  assert.equal(g.invoices(), 1);
  assert.equal(pending.payment.invoiceState, "unknown");
});
test("paid webhook consumes stock and coupon once; replays, stale events and wrong amounts cannot corrupt state", async () => {
  const f = fixture();
  f.rows.set("promotionBooks/development/codes/UCB-TEST", {
    campaign: promotionCampaign,
    percent: 10,
    expiresAt: Date.now() + 86400000,
  });
  const order = await f.creation.createOrder(
    { ...f.input, promoCode: "UCB-TEST", expectedTotalMinor: 9000 },
    randomUUID(),
    "test",
  );
  await f.payment.ensureInvoice(order);
  const invoice = success(order);
  await f.payment.applyPayment(invoice);
  await f.payment.applyPayment(invoice);
  await f.payment.applyPayment(
    success(order, "processing", "2026-11-11T19:00:00Z"),
  );
  const stored = f.rows.get(
    `orderBooks/development/orders/${order.id}`,
  )! as unknown as Order;
  assert.equal(stored.payment.status, "paid");
  assert.equal(stored.inventoryState, "consumed");
  const stock = (
    f.rows.get(
      `${catalogCollections.caviar.records}/premium`,
    )! as unknown as typeof f.record
  ).data.stock[f.pack.id]!;
  assert.equal(stock.quantity, 1);
  assert.equal(stock.reserved, 0);
  assert.equal(
    f.rows.get("promotionBooks/development/codes/UCB-TEST")?.consumedBy,
    order.id,
  );
  await assert.rejects(f.payment.applyPayment({ ...invoice, amount: 1 }));
  await assert.rejects(
    f.payment.applyPayment({ ...invoice, invoiceId: "another" }),
  );
  assert.equal(
    f.rows.get(`orderBooks/development/orders/${order.id}/notifications/paid`)
      ?.state,
    "pending",
  );
});
test("failed payment releases reservations and coupon; subsequent late payment is marked for staff review", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(f.input, randomUUID(), "test");
  await f.payment.ensureInvoice(order);
  const failed = await f.payment.applyPayment(success(order, "expired"));
  assert.equal(failed.inventoryState, "released");
  const late = await f.payment.applyPayment(
    success(order, "success", "2026-11-11T20:01:00Z"),
  );
  assert.equal(late.payment.status, "paid");
  assert.equal(late.status, "dispute");
});
test("offline acceptance consumes coupon immediately and never invents paid status", async () => {
  const f = fixture();
  f.rows.set("promotionBooks/development/codes/UCB-TEST", {
    campaign: promotionCampaign,
    percent: 10,
    expiresAt: Date.now() + 86400000,
  });
  const order = await f.creation.createOrder(
    {
      ...f.input,
      contact: { ...f.input.contact, payment: "transfer" },
      promoCode: "UCB-TEST",
      expectedTotalMinor: 9000,
    },
    randomUUID(),
    "test",
  );
  assert.equal(order.payment.status, "pending");
  assert.equal(order.inventoryState, "consumed");
  assert.equal(order.lines[0]!.batches?.[0]?.quantity, 1);
  assert.equal(
    f.rows.get("promotionBooks/development/codes/UCB-TEST")?.consumedBy,
    order.id,
  );
});
test("raw-body ECDSA signatures reject tampering and payment state is monotonic", () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicKey = Buffer.from(
    keys.publicKey.export({ type: "spki", format: "pem" }),
  ).toString("base64");
  const body = '{"amount":100}';
  const signer = createSign("SHA256");
  signer.update(body);
  signer.end();
  const signature = signer.sign(keys.privateKey, "base64");
  assert.ok(verifyMonoSignature(body, signature, publicKey));
  assert.equal(verifyMonoSignature(body + " ", signature, publicKey), false);
  assert.equal(verifyMonoSignature(body, "bad", publicKey), false);
  assert.equal(
    paymentTransition("paid", 0, {
      invoiceId: "x",
      amount: 100,
      ccy: 980,
      modifiedDate: "2026-11-11T20:00:00Z",
      status: "failure",
    }),
    null,
  );
});
test("promotion preserves legacy trout exclusions and supports new all-product scopes", () => {
  const rows = initialCaviar().map((row) => row.data.copy.ua);
  const trout = rows.find((row) => row.id === "trout")!;
  const premium = rows.find((row) => row.id === "premium")!;
  const lines = [
    ...trout.variants.map((v) => ({ variantId: v.id, quantity: 1 })),
    { variantId: premium.variants[0]!.id, quantity: 1 },
  ];
  const promo = {
    code: "UCB-TEST",
    percent: 10,
    excludedProductIds: ["trout"],
  };
  assert.equal(
    promotionEligibleSubtotal(lines, rows, promo),
    premium.variants[0]!.priceMinor,
  );
  assert.equal(
    promotionEligibleSubtotal(lines, rows, {
      ...promo,
      productIds: ["sterlet"],
    }),
    0,
  );
  assert.equal(
    promotionEligibleSubtotal(lines, rows, {
      ...promo,
      excludedProductIds: [],
    }),
    premium.variants[0]!.priceMinor +
      trout.variants.reduce((sum, v) => sum + v.priceMinor, 0),
  );
  assert.equal(promotionTotals(10000, promo, 5000).discountMinor, 500);
  const code = { percent: 10, expiresAt: Date.now() + 100000 };
  assert.ok(promotionUsable(code, Date.now()));
  assert.equal(
    promotionUsable({ ...code, consumedBy: "order" }, Date.now()),
    false,
  );
  assert.equal(
    promotionUsable({ ...code, reservedBy: "other" }, Date.now()),
    false,
  );
  assert.ok(
    promotionUsable({ ...code, reservedBy: "order" }, Date.now(), "order"),
  );
  assert.equal(
    promotionUsable({ ...code, expiresAt: null }, Date.now()),
    false,
  );
});
test("stock reserve/release is exact and batch dates do not block consumption", () => {
  const stock = {
    quantity: 3,
    reserved: 0,
    batches: [
      { code: "OLD", expiresOn: "2020-01-01", quantity: 1 },
      { code: "NEW", expiresOn: "2099-01-01", quantity: 2 },
    ],
  };
  const held = reserveStock(stock, 2, "2026-11-11");
  assert.equal(reserveStock(held, 1, "2026-11-11").reserved, 3);
  assert.throws(() => reserveStock(held, 2, "2026-11-11"));
  assert.deepEqual(releaseStock(held, 2), stock);
  const consumed = consumeStock(held, 2, "2026-11-11");
  assert.equal(consumed.quantity, 1);
  assert.equal(consumed.batches[0]?.code, "NEW");
});

test("past batch dates do not interrupt verified payment or stock consumption", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(f.input, randomUUID(), "test");
  await f.payment.ensureInvoice(order);
  const record = f.rows.get(
    `${catalogCollections.caviar.records}/premium`,
  )! as unknown as typeof f.record;
  record.data.stock[f.pack.id]!.batches[0]!.expiresOn = "2000-01-01";
  const result = await f.payment.applyPayment(success(order));
  assert.equal(result.payment.status, "paid");
  assert.notEqual(result.status, "dispute");
  assert.equal(result.inventoryState, "consumed");
});
test("offline cancellation restores the exact stock batches and keeps its consumed coupon", async () => {
  const f = fixture();
  f.rows.set("promotionBooks/development/codes/UCB-TEST", {
    campaign: promotionCampaign,
    percent: 10,
    expiresAt: Date.now() + 86400000,
  });
  const order = await f.creation.createOrder(
    {
      ...f.input,
      contact: { ...f.input.contact, payment: "transfer" },
      promoCode: "UCB-TEST",
      expectedTotalMinor: 9000,
    },
    randomUUID(),
    "test",
  );
  f.rows.set(`orderBooks/development/orders/${order.id}`, {
    ...f.rows.get(`orderBooks/development/orders/${order.id}`),
    status: "processing",
  });
  const { cancelOrder } = serverModule<
    typeof import("../../src/lib/server/orders/cancel.ts")
  >("src/lib/server/orders/cancel.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => f.db,
    },
  });
  const result = await cancelOrder(order.id, 1, { uid: "test-staff" });
  assert.ok("changed" in result && result.changed);
  const record = f.rows.get(
    `${catalogCollections.caviar.records}/premium`,
  )! as unknown as typeof f.record;
  assert.deepEqual(
    record.data.stock[f.pack.id],
    f.record.data.stock[f.pack.id],
  );
  assert.equal(
    f.rows.get("promotionBooks/development/codes/UCB-TEST")?.consumedBy,
    order.id,
  );
});
test("cancelling a paid order keeps the stock consumed and asks staff to return it", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(f.input, randomUUID(), "test");
  await f.payment.ensureInvoice(order);
  const paid = await f.payment.applyPayment(success(order));
  assert.equal(paid.payment.status, "paid");
  assert.equal(paid.inventoryState, "consumed");
  const path = `orderBooks/development/orders/${order.id}`;
  const stored = f.rows.get(path)!;
  f.rows.set(path, { ...stored, status: "processing" });
  const sold = structuredClone(
    (
      f.rows.get(
        `${catalogCollections.caviar.records}/premium`,
      )! as unknown as typeof f.record
    ).data.stock[f.pack.id],
  );
  const { cancelOrder } = serverModule<
    typeof import("../../src/lib/server/orders/cancel.ts")
  >("src/lib/server/orders/cancel.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => f.db,
    },
  });
  const result = await cancelOrder(order.id, stored.revision as number, {
    uid: "test-staff",
  });
  assert.ok("changed" in result && result.changed);
  const cancelled = f.rows.get(path)!;
  // The money arrived, so the jar may already be gone: cancelling must not
  // invent stock back. The admin says so before it runs and lists it after.
  assert.deepEqual(
    (
      f.rows.get(
        `${catalogCollections.caviar.records}/premium`,
      )! as unknown as typeof f.record
    ).data.stock[f.pack.id],
    sold,
  );
  assert.equal(cancelled.inventoryState, "consumed");
  const cancellation = cancelled.cancellation as Order["cancellation"];
  assert.equal(cancellation?.refundRequired, true);
  assert.equal(cancellation?.stockReturnRequired, true);
});
test("manual TTN is free-form, never gates fulfilment and mails only on request", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(f.input, randomUUID(), "test");
  await f.payment.ensureInvoice(order);
  await f.payment.applyPayment(success(order));
  const path = `orderBooks/development/orders/${order.id}`;
  const stored = f.rows.get(path)! as unknown as Order;
  let verified = 0;
  const { saveTracking } = serverModule<
    typeof import("../../src/lib/server/orders/tracking.ts")
  >("src/lib/server/orders/tracking.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => f.db,
    },
    [resolve("src/lib/server/delivery/nova-poshta.ts")]: {
      verifyTracking: async () => {
        verified++;
        return { statusCode: "1", checkedAt: Date.now() };
      },
    },
    "firebase-admin/firestore": {
      FieldValue: { delete: () => ({ __delete: true }) },
    },
  });
  const actor = { uid: "test-staff" };
  const shipments = () =>
    [...f.rows.keys()].filter((key) =>
      key.includes("/notifications/shipment-"),
    );

  // Packing may be skipped entirely, and a carrier number is not required.
  const free = await saveTracking(
    order.id,
    "  manual-parcel 7 ",
    stored.revision,
    actor,
    false,
  );
  assert.deepEqual(free, {
    changed: true,
    check: "skipped",
    notified: false,
  });
  assert.equal(
    (f.rows.get(path) as unknown as Order).delivery?.trackingNumber,
    "manual-parcel 7",
  );
  assert.equal(verified, 0);
  assert.deepEqual(shipments(), []);
  assert.equal(
    (f.rows.get(path) as unknown as Order).mail?.shipment,
    undefined,
  );

  // A waybill-shaped number is checked with the carrier, and the email is opt-in.
  const number = "20450000000000";
  // With order mail globally off, asking for it must not queue a job nobody sends.
  delete process.env.ORDER_EMAIL_ENABLED;
  assert.deepEqual(
    await saveTracking(order.id, number, stored.revision + 1, actor, true),
    { changed: true, check: "ok", notified: false },
  );
  assert.deepEqual(shipments(), []);
  process.env.ORDER_EMAIL_ENABLED = "true";
  await saveTracking(
    order.id,
    "manual-parcel 7",
    stored.revision + 2,
    actor,
    false,
  );
  const notified = await saveTracking(
    order.id,
    number,
    stored.revision + 3,
    actor,
    true,
  );
  assert.deepEqual(notified, { changed: true, check: "ok", notified: true });
  assert.equal(verified, 2);
  assert.equal(shipments().length, 1);
  assert.equal(
    (f.rows.get(path) as unknown as Order).mail?.shipment,
    "pending",
  );

  // The same number never produces a second email.
  assert.deepEqual(
    await saveTracking(order.id, number, stored.revision + 4, actor, true),
    { changed: false, check: "ok", notified: false },
  );
  assert.equal(shipments().length, 1);

  // Stale revisions are rejected, cancelled orders accept no number, only removal.
  assert.deepEqual(
    await saveTracking(order.id, number, stored.revision, actor, false),
    { error: "conflict" },
  );
  assert.deepEqual(
    await saveTracking(order.id, "ТТН/\\", stored.revision + 4, actor, false),
    { error: "invalid" },
  );
  f.rows.set(path, { ...f.rows.get(path), status: "cancelled" });
  assert.deepEqual(
    await saveTracking(order.id, number, stored.revision + 4, actor, false),
    { error: "invalid" },
  );
  const cleared = await saveTracking(
    order.id,
    "",
    stored.revision + 4,
    actor,
    false,
  );
  assert.deepEqual(cleared, {
    changed: true,
    check: "skipped",
    notified: false,
  });
  assert.equal(
    (f.rows.get(path) as unknown as Order).delivery?.trackingNumber,
    undefined,
  );
});
test("order notifications are accepted once; transport failure never rolls back the order", async () => {
  const f = fixture();
  const order = await f.creation.createOrder(
    { ...f.input, contact: { ...f.input.contact, payment: "transfer" } },
    randomUUID(),
    "test",
  );
  process.env.ORDER_EMAIL_ENABLED = "true";
  let sent = 0;
  const { deliverOrderNotifications } = serverModule<
    typeof import("../../src/lib/server/orders/notifications.ts")
  >("src/lib/server/orders/notifications.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => f.db,
    },
    [resolve("src/lib/server/mail/smtp.ts")]: {
      MailError: class extends Error {},
      sendMail: async () => {
        sent++;
        return {};
      },
    },
  });
  await Promise.all([
    deliverOrderNotifications(order.id),
    deliverOrderNotifications(order.id),
  ]);
  assert.equal(sent, 1);
  assert.equal(
    f.rows.get(
      `orderBooks/development/orders/${order.id}/notifications/created`,
    )?.state,
    "accepted",
  );
  const other = await f.creation.createOrder(
    {
      ...f.input,
      contact: {
        ...f.input.contact,
        payment: "transfer",
        email: "other@example.com",
      },
    },
    randomUUID(),
    "test",
  );
  const failed = serverModule<
    typeof import("../../src/lib/server/orders/notifications.ts")
  >("src/lib/server/orders/notifications.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => f.db,
    },
    [resolve("src/lib/server/mail/smtp.ts")]: {
      MailError: class extends Error {},
      sendMail: async () => {
        throw new Error("Disconnected after DATA");
      },
    },
  });
  await failed.deliverOrderNotifications(other.id);
  assert.ok(f.rows.has(`orderBooks/development/orders/${other.id}`));
  assert.equal(
    f.rows.get(
      `orderBooks/development/orders/${other.id}/notifications/created`,
    )?.state,
    "unknown",
  );
});

test("online checkout stays silent until verified payment, then queues one paid owner copy", async () => {
  const f = fixture();
  process.env.OWNER_NOTIFICATION_EMAILS = "owner@example.com";
  try {
    const order = await f.creation.createOrder(f.input, randomUUID(), "test");
    assert.equal(
      [...f.rows.keys()].some((k) => k.startsWith("mailJobs/")),
      false,
    );
    assert.equal(
      f.rows.has(
        `orderBooks/development/orders/${order.id}/notifications/created`,
      ),
      false,
    );
    // Old pending creation notices must also stay silent after this deployment.
    f.rows.set(
      `orderBooks/development/orders/${order.id}/notifications/created`,
      { state: "pending" },
    );
    let sent = 0;
    const { deliverOrderNotifications } = serverModule<
      typeof import("../../src/lib/server/orders/notifications.ts")
    >("src/lib/server/orders/notifications.ts", {
      [resolve("src/lib/server/firestore.ts")]: {
        firebaseAdminDatabase: () => f.db,
      },
      [resolve("src/lib/server/mail/jobs.ts")]: {
        deliverMailJobs: async () => {},
      },
      [resolve("src/lib/server/mail/smtp.ts")]: {
        MailError: class extends Error {},
        sendMail: async () => {
          sent++;
        },
      },
    });
    process.env.ORDER_EMAIL_ENABLED = "true";
    await deliverOrderNotifications(order.id);
    assert.equal(sent, 0);
    await f.payment.ensureInvoice(order);
    await f.payment.applyPayment(success(order));
    await f.payment.applyPayment(success(order));
    const jobs = [...f.rows.entries()].filter(([k]) =>
      k.startsWith("mailJobs/"),
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.[1]?.paid, true);
    await deliverOrderNotifications(order.id);
    await deliverOrderNotifications(order.id);
    assert.equal(sent, 1);
  } finally {
    delete process.env.OWNER_NOTIFICATION_EMAILS;
  }
});
