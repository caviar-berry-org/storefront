import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { inflateRawSync } from "node:zlib";
import { serverModule } from "../helpers/server-module.ts";
import { workbook, workbookSheets } from "../../src/lib/server/workbook.ts";
import type { Order } from "../../src/domain/orders.ts";

/** Reads the parts back out of the zip the builder writes. */
function parts(file: Buffer) {
  const entries = new Map<string, string>();
  let offset = 0;
  while (file.readUInt32LE(offset) === 0x04034b50) {
    const compressed = file.readUInt32LE(offset + 18);
    const nameLength = file.readUInt16LE(offset + 26);
    const extraLength = file.readUInt16LE(offset + 28);
    const name = file
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString();
    const start = offset + 30 + nameLength + extraLength;
    entries.set(
      name,
      inflateRawSync(file.subarray(start, start + compressed)).toString(),
    );
    offset = start + compressed;
  }
  return entries;
}

test("a workbook declares every sheet it carries", () => {
  const entries = parts(
    workbookSheets([
      { name: "Замовлення", rows: [["Номер"], ["CB-1"]] },
      { name: "Склад замовлення", rows: [["Товар"], ["Ікра"]] },
    ]),
  );
  for (const path of ["xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"])
    assert.ok(entries.has(path), `${path} is missing`);
  const index = entries.get("xl/workbook.xml")!;
  assert.match(index, /name="Замовлення" sheetId="1" r:id="rId1"/);
  assert.match(index, /name="Склад замовлення" sheetId="2" r:id="rId2"/);
  const rels = entries.get("xl/_rels/workbook.xml.rels")!;
  assert.match(rels, /Id="rId1"[^>]*Target="worksheets\/sheet1\.xml"/);
  assert.match(rels, /Id="rId2"[^>]*Target="worksheets\/sheet2\.xml"/);
  const types = entries.get("[Content_Types].xml")!;
  for (const path of ["sheet1", "sheet2"])
    assert.ok(
      types.includes(`/xl/worksheets/${path}.xml`),
      `${path} has no content type`,
    );
  assert.ok(entries.get("xl/worksheets/sheet2.xml")!.includes("Ікра"));
});

test("columns past Z keep A1 references Excel can read", () => {
  // The orders sheet is already 19 columns wide; a hand-rolled
  // String.fromCharCode would emit "[" for the 27th.
  const width = 30;
  const sheet = parts(
    workbookSheets([
      {
        name: "Широкий",
        rows: [Array.from({ length: width }, (_, i) => `h${i}`)],
      },
    ]),
  ).get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /<c r="Z1"/);
  assert.match(sheet, /<c r="AA1"/);
  assert.match(sheet, /<c r="AD1"/);
  assert.doesNotMatch(sheet, /<c r="\[/);
  assert.match(sheet, /autoFilter ref="A1:AD1"/);
});

test("a single-sheet workbook keeps its shape and escapes cell text", () => {
  const entries = parts(workbook([["Промокод & «ціна» <10%>"]], "Звіт"));
  assert.equal(entries.has("xl/worksheets/sheet2.xml"), false);
  assert.match(entries.get("xl/workbook.xml")!, /name="Звіт"/);
  assert.ok(
    entries
      .get("xl/worksheets/sheet1.xml")!
      .includes("Промокод &amp; «ціна» &lt;10%&gt;"),
  );
});

/** Cell text of every row of a sheet part, in order. */
function grid(sheet: string) {
  return sheet
    .split("<row ")
    .slice(1)
    .map((row) =>
      [...row.matchAll(/<t xml:space="preserve">([\s\S]*?)<\/t>/g)].map(
        ([, cell]) =>
          (cell ?? "")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&quot;", '"')
            .replaceAll("&apos;", "'")
            .replaceAll("&amp;", "&"),
      ),
    );
}

const line = (over: Partial<Order["lines"][number]>) => ({
  productId: "caviar-1",
  variantId: "pack-1",
  name: "Ікра осетрова",
  weightGrams: 50,
  quantity: 1,
  unitPriceMinor: 70000,
  ...over,
});

/** An online order still awaiting payment, and a transfer already written off. */
const stored = [
  {
    number: "CB-1",
    createdAt: Date.UTC(2026, 10, 25, 8, 0),
    status: "awaitingPayment",
    type: "online",
    customer: {
      name: "Клієнт Один",
      email: "one@example.com",
      phone: "+380",
      type: "retail",
    },
    totalMinor: 140000,
    subtotalMinor: 140000,
    discountMinor: 0,
    payment: { status: "pending" },
    delivery: { method: "branch", city: "Київ", destination: "Відділення №1" },
    lines: [
      line({ quantity: 2 }),
      line({ weightGrams: 100, name: "Ікра червона" }),
    ],
  },
  {
    number: "CB-2",
    createdAt: Date.UTC(2026, 10, 24, 8, 0),
    status: "packed",
    type: "iban",
    customer: {
      name: "Клієнт Два",
      email: "two@example.com",
      phone: "+381",
      type: "retail",
    },
    totalMinor: 280000,
    subtotalMinor: 280000,
    discountMinor: 0,
    shippingMinor: 0,
    payment: { status: "paid" },
    delivery: {
      method: "courier",
      city: "Львів",
      destination: "вул. Тестова 1",
      trackingNumber: "20450000000001",
    },
    // Four units sold, three of them traced to batches.
    lines: [
      line({
        quantity: 4,
        batches: [
          { code: "B-240", expiresOn: "2027-05-12", quantity: 2 },
          { code: "B-241", expiresOn: "2027-08-01", quantity: 1 },
        ],
      }),
    ],
  },
];

async function exported() {
  const route = serverModule<
    typeof import("../../src/app/(staff)/admin/orders/export/route.ts")
  >("src/app/(staff)/admin/orders/export/route.ts", {
    "firebase-admin/firestore": { FieldPath: { documentId: () => "__name__" } },
    [resolve("src/lib/server/staff-session.ts")]: {
      getStaffSession: async () => ({ uid: "staff-1", name: "Staff" }),
    },
    [resolve("src/lib/server/orders/storage.ts")]: {
      orderCollection: () => {
        const query = {
          orderBy: () => query,
          limit: () => query,
          select: () => query,
          startAfter: () => query,
          get: async () => ({
            size: stored.length,
            docs: stored.map((order) => ({ data: () => order })),
          }),
        };
        return query;
      },
    },
  });
  const response = await route.GET();
  assert.equal(response.status, 200);
  return parts(Buffer.from(await response.arrayBuffer()));
}

test("the orders sheet keeps one row per order and names what was ordered", async () => {
  const sheet = grid((await exported()).get("xl/worksheets/sheet1.xml")!);
  const row = (index: number) =>
    sheet[index] ?? assert.fail(`row ${index} is missing`);
  const [header, first, second] = [row(0), row(1), row(2)];
  assert.equal(sheet.length, stored.length + 1);
  assert.equal(header.length, 19);
  assert.equal(header.at(-1), "Склад замовлення");
  for (const row of [first, second]) assert.equal(row.length, header.length);
  assert.deepEqual(first.slice(9, 15), [
    "1400.00",
    "Очікує підтвердження",
    "1400.00",
    "0.00",
    "—",
    "У відділення",
  ]);
  assert.equal(
    first.at(-1),
    "Ікра осетрова · 50 г × 2 шт.; Ікра червона · 100 г × 1 шт.",
  );
  assert.equal(second.at(-2), "20450000000001");
});

test("the positions sheet traces batches without counting a line's money twice", async () => {
  const rows = grid((await exported()).get("xl/worksheets/sheet2.xml")!);
  // Two unpaid lines, then one line spread over two batches plus its untraced unit.
  assert.deepEqual(
    rows.slice(1).map((row) => row.slice(0, 1).concat(row.slice(3))),
    [
      [
        "CB-1",
        "Ікра осетрова",
        "50 г",
        "2",
        "700.00",
        "1400.00",
        "—",
        "—",
        "—",
      ],
      ["CB-1", "Ікра червона", "100 г", "1", "700.00", "700.00", "—", "—", "—"],
      [
        "CB-2",
        "Ікра осетрова",
        "50 г",
        "4",
        "700.00",
        "2800.00",
        "B-240",
        "2",
        "12.05.2027",
      ],
      ["CB-2", "Ікра осетрова", "50 г", "", "", "", "B-241", "1", "01.08.2027"],
      ["CB-2", "Ікра осетрова", "50 г", "", "", "", "Без партії", "1", "—"],
    ],
  );
});
