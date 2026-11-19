import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";
import { memoryFirestore } from "../helpers/firestore.ts";

process.env.APP_ENV = "development";

function fixture() {
  const memory = memoryFirestore();
  const sent: { title: string; fields: Record<string, unknown> }[] = [];
  const digest = serverModule<
    typeof import("../../src/lib/server/notify/digest.ts")
  >("src/lib/server/notify/digest.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => memory.db,
    },
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
  return { memory, sent, digest };
}

const order = (
  id: string,
  status: string,
  totalMinor: number,
  payment: string,
  age = 0,
) => [
  `orderBooks/development/orders/${id}`,
  {
    status,
    totalMinor,
    payment: { status: payment },
    createdAt: Date.now() - age,
  },
];

test("the summary reports money that arrived, never money that was merely ordered", async () => {
  const f = fixture();
  for (const [path, data] of [
    order("a", "processing", 70000, "paid"),
    // Placed, not paid: belongs on the awaited line, not in the money.
    order("b", "new", 250000, "pending"),
    // Counted as an order; in neither figure.
    order("c", "cancelled", 999900, "pending"),
    // Older than the window: belongs to a summary already sent.
    order("d", "new", 500000, "paid", 40 * 3600000),
  ] as [string, Record<string, unknown>][])
    f.memory.rows.set(path, data);
  f.memory.rows.set("inquiries/one", {
    kind: "corporate",
    createdAt: Date.now(),
  });
  f.memory.rows.set("inquiries/old", {
    kind: "gift",
    createdAt: Date.now() - 40 * 3600000,
  });

  await f.digest.sendDigest("За останню добу", 86_400_000, "test");

  assert.equal(f.sent.length, 1);
  const { fields } = f.sent[0]!;
  assert.equal(fields.Замовлень, 3, "the window must exclude yesterday");
  // Matched loosely: the formatter groups thousands with a non-breaking space.
  assert.match(
    String(fields.Оплачено),
    /^700\s?грн$/,
    `an unpaid or cancelled order was counted as money: ${fields.Оплачено}`,
  );
  assert.match(
    String(fields["Очікує оплати"]),
    /^1 на 2\s?500\s?грн$/,
    `the awaited line is wrong: ${fields["Очікує оплати"]}`,
  );
  assert.equal(fields.Заявок, 1);
  assert.match(String(fields.Статуси), /Скасовано 1/);
  assert.match(String(fields.Статуси), /У роботі 1/);
  assert.equal(fields.Увага, undefined);
});

test("an empty window still reports, so silence is never ambiguous", async () => {
  const f = fixture();
  await f.digest.sendDigest("За останню добу", 86_400_000, "test");
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0]!.fields.Замовлень, 0);
  assert.match(String(f.sent[0]!.fields.Оплачено), /^0\s?грн$/);
  // Nothing awaited means no line at all.
  assert.equal(f.sent[0]!.fields["Очікує оплати"], undefined);
});
