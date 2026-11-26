import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";

const observability = serverModule<
  typeof import("../../src/lib/server/observability.ts")
>("src/lib/server/observability.ts", {});

test("the Firestore ruleset denies every client path", () => {
  const rules = readFileSync("firestore.rules", "utf8");
  const allows = rules.match(/allow[^;]*;/g) ?? [];
  // No browser code ever opens a Firestore connection, while the web API key and
  // project id are both present for Google sign-in. Any `allow` that is not
  // `if false` would expose orders and customers to that key.
  assert.ok(allows.length > 0, "ruleset declares no allow rule at all");
  for (const rule of allows)
    assert.match(rule.replace(/\s+/g, " "), /allow read, write: if false;/);
  assert.match(rules, /match \/\{document=\*\*\}/);
  const firebase: { firestore?: { rules?: string } } = JSON.parse(
    readFileSync("firebase.json", "utf8"),
  );
  assert.equal(firebase.firestore?.rules, "firestore.rules");
});

test("commerce logs keep contact details out of the log stream", () => {
  const { logSafeValue } = observability;
  for (const value of [
    "customer@example.com",
    " Person@Example.COM ",
    "+380671234567",
    "0671234567",
    "067 123 45 67",
    "(067) 123-45-67",
  ])
    assert.equal(logSafeValue(value), "[redacted]", String(value));
  // Identifiers and amounts must stay readable, or the log is useless.
  const order = "a".repeat(8) + "1".repeat(8) + "b".repeat(24);
  assert.equal(logSafeValue(order), order);
  assert.equal(logSafeValue("invoice_test-01"), "invoice_test-01");
  assert.equal(logSafeValue(150000), 150000);
  assert.equal(logSafeValue(true), true);
  assert.equal(logSafeValue(undefined), null);
  assert.equal(logSafeValue(Number.NaN), null);
  assert.equal(String(logSafeValue("x".repeat(400))).length, 200);
});

test("commerce events are emitted as one greppable line", () => {
  const original = console.error;
  const lines: string[] = [];
  console.error = (line: string) => lines.push(line);
  try {
    observability.logCommerce("error", "payment.rejected", {
      reason: "amount",
      email: "someone@example.com",
    });
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 1);
  assert.ok(lines[0]!.startsWith("[commerce] "));
  const payload = JSON.parse(lines[0]!.slice("[commerce] ".length));
  assert.deepEqual(payload, {
    event: "payment.rejected",
    reason: "amount",
    email: "[redacted]",
  });
});

test("a payment that can never match is rejected, a missing order is not", async () => {
  process.env.APP_ENV = "development";
  const rows = new Map<string, Record<string, unknown>>();
  const order = {
    id: "a".repeat(40),
    totalMinor: 150000,
    revision: 1,
    status: "new",
    lines: [],
    payment: {
      method: "online",
      status: "pending",
      invoiceId: "invoice_test",
      invoiceState: "ready",
    },
  };
  rows.set(`orderBooks/development/orders/${order.id}`, order);
  const { applyPayment, PaymentRejected } = serverModule<
    typeof import("../../src/lib/server/checkout/payment.ts")
  >("src/lib/server/checkout/payment.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => ({
        collection: () => ({
          doc: (id: string) => ({
            get: async () => ({
              exists: rows.has(`orderBooks/development/orders/${id}`),
              id,
              data: () => rows.get(`orderBooks/development/orders/${id}`),
            }),
          }),
        }),
        runTransaction: async (run: (tx: unknown) => Promise<unknown>) =>
          run({
            get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
          }),
      }),
    },
    "firebase-admin/firestore": { FieldValue: { delete: () => ({}) } },
  });
  const invoice: Parameters<typeof applyPayment>[0] = {
    invoiceId: "invoice_test",
    status: "success",
    amount: 150000,
    ccy: 980,
    reference: order.id,
    modifiedDate: new Date().toISOString(),
  };

  const rejected = async (patch: Partial<typeof invoice>, reason: string) => {
    await assert.rejects(
      () => applyPayment({ ...invoice, ...patch }),
      (error: unknown) => {
        assert.ok(error instanceof PaymentRejected, `${reason}: wrong type`);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  };
  await rejected({ reference: "not-a-reference" }, "reference");
  await rejected({ amount: 100 }, "amount");
  await rejected({ finalAmount: 100 }, "final-amount");
  await rejected({ invoiceId: "another_invoice" }, "invoice");

  // A payment we failed to read must keep being redelivered, never acknowledged.
  rows.clear();
  await assert.rejects(
    () => applyPayment(invoice),
    (error: unknown) => {
      assert.ok(!(error instanceof PaymentRejected));
      return true;
    },
  );
});

test("reconciliation retries mail by state, so an old order is not left behind", async () => {
  process.env.APP_ENV = "development";
  process.env.CRON_SECRET = "c".repeat(40);
  const delivered: string[] = [];
  let queueDrains = 0;
  // One stalled letter on an order far outside any "most recent" window.
  const stalled = [
    { order: "old-order", state: "pending" },
    { order: "old-order", state: "failed" },
    { order: "another-order", state: "pending" },
  ];
  const { GET } = serverModule<
    typeof import("../../src/app/api/internal/reconcile/route.ts")
  >("src/app/api/internal/reconcile/route.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => ({
        collection: () => ({
          where: () => ({
            where: () => ({
              where: () => ({
                limit: () => ({ get: async () => ({ docs: [] }) }),
              }),
            }),
          }),
        }),
        collectionGroup: (name: string) => {
          assert.equal(name, "notifications");
          return {
            where: (field: string, op: string, values: string[]) => {
              assert.equal(field, "state");
              // "sending" is ambiguous and must never be auto-resent.
              assert.deepEqual(values, ["pending", "failed"]);
              return {
                limit: () => ({
                  get: async () => ({
                    docs: stalled.map((row) => ({
                      ref: { parent: { parent: { id: row.order } } },
                    })),
                  }),
                }),
              };
            },
          };
        },
      }),
    },
    [resolve("src/lib/server/orders/storage.ts")]: {
      orderCollection: () => ({
        where: () => ({
          where: () => ({
            where: () => ({
              limit: () => ({ get: async () => ({ docs: [] }) }),
            }),
          }),
        }),
      }),
      orderData: () => null,
    },
    [resolve("src/lib/server/orders/notifications.ts")]: {
      deliverCustomerNotifications: async (id: string) => {
        delivered.push(id);
      },
    },
    [resolve("src/lib/server/mail/jobs.ts")]: {
      queueRestockMail: async () => {},
      deliverMailJobs: async () => {
        queueDrains++;
      },
    },
    [resolve("src/lib/server/checkout/payment.ts")]: {
      reconcileOrder: async () => {},
    },
  });

  const run = (authorization?: string) =>
    GET(
      new Request("https://example.com/api/internal/reconcile", {
        ...(authorization && { headers: { authorization } }),
      }),
    );
  assert.equal((await run()).status, 401);
  assert.equal((await run("Bearer wrong")).status, 401);
  assert.equal(delivered.length, 0);

  const response = await run(`Bearer ${process.env.CRON_SECRET}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    checked: 0,
    unavailable: 0,
    mailed: 2,
  });
  // Each order once, however many of its letters are stalled.
  assert.deepEqual(delivered.sort(), ["another-order", "old-order"]);
  // The shared queue is drained once per run, not once per order.
  assert.equal(queueDrains, 1);
});

/**
 * Scanner probes die in Next's body decoding before any of our code runs. They
 * must not reach the chat, and a real crash must still get there — a filter
 * that quietly widens would take the alerting with it.
 */
function crashes() {
  const sent: { title: string; fields: Record<string, unknown> }[] = [];
  const { onRequestError } = serverModule<
    typeof import("../../src/instrumentation.ts")
  >("src/instrumentation.ts", {
    [resolve("src/lib/server/notify/telegram.ts")]: {
      notify: async (
        _category: string,
        title: string,
        fields: Record<string, unknown>,
      ) => {
        sent.push({ title, fields });
        return true;
      },
    },
  });
  return { sent, onRequestError };
}

const request = { path: "/index.php", method: "POST", headers: {} };
const context = {
  routerKind: "App Router",
  routePath: "/[locale]/page",
  routeType: "render",
  revalidateReason: undefined,
} as const;

test("an unreadable request body never reaches the chat", async () => {
  const { sent, onRequestError } = crashes();
  const missingBoundary = new TypeError("Failed to parse body as FormData.", {
    cause: new TypeError("missing boundary in content-type header"),
  });
  await onRequestError(missingBoundary, request, context);
  await onRequestError(
    new TypeError("Failed to parse body as URLSearchParams"),
    request,
    context,
  );
  // Only the cause names the boundary, as Next reports it on some paths.
  await onRequestError(
    new TypeError("Body already read", {
      cause: new TypeError("no boundary found in multipart body"),
    }),
    request,
    context,
  );
  assert.deepEqual(sent, []);
});

test("an ordinary crash still reports its route and message", async () => {
  const { sent, onRequestError } = crashes();
  await onRequestError(new Error("Firestore unavailable"), request, context);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.title, "/[locale]/page");
  assert.equal(sent[0]?.fields.Помилка, "Firestore unavailable");
  assert.equal(sent[0]?.fields.Запит, "POST /index.php");
});
