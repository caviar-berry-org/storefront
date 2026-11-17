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

const order = (id: string, status: string, totalMinor: number, age = 0) => [
  `orderBooks/development/orders/${id}`,
  { status, totalMinor, createdAt: Date.now() - age },
];

test("the summary counts the window and never calls a cancelled order money", async () => {
  const f = fixture();
  for (const [path, data] of [
    order("a", "new", 70000),
    order("b", "processing", 250000),
    // Cancelled: it happened, so it is counted, but it never became revenue.
    order("c", "cancelled", 999900),
    // Older than the window: belongs to a summary already sent.
    order("d", "new", 500000, 40 * 3600000),
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
    String(fields.Сума),
    /^3\s?200\s?грн$/,
    `a cancelled order inflated the revenue: ${fields.Сума}`,
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
  assert.match(String(f.sent[0]!.fields.Сума), /^0\s?грн$/);
});
