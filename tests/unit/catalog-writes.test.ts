import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { initialCaviar } from "../../src/lib/catalog-fixtures.ts";
import {
  catalogCollections,
  catalogSupport,
} from "../../src/lib/catalog-collections.ts";
import type { CatalogRecord } from "../../src/domain/managed-catalog.ts";
import { serverModule } from "../helpers/server-module.ts";

function database() {
  const rows = new Map<string, Record<string, unknown>>();
  let sequence = 0;
  const ref = (path: string) => ({ path });
  const snapshot = ({ path }: { path: string }) => ({
    exists: rows.has(path),
    data: () => structuredClone(rows.get(path)),
    get: (field: string) => rows.get(path)?.[field],
    ref: ref(path),
  });
  const db = {
    collection: (path: string) => ({
      doc: (id = `audit-${++sequence}`) => ref(`${path}/${id}`),
      orderBy: (field: string, direction: "asc" | "desc" = "asc") => ({
        limit: (take: number) => ({ path, field, direction, take }),
      }),
    }),
    runTransaction: async (run: (tx: unknown) => Promise<unknown>) => {
      const writes: (() => void)[] = [];
      const read = (doc: {
        path: string;
        field?: string;
        direction?: "asc" | "desc";
        take?: number;
      }) => {
        assert.equal(
          writes.length,
          0,
          "Firestore requires all reads before writes",
        );
        if (doc.field === undefined) return snapshot(doc);
        const ordered = [...rows]
          .filter(
            ([key]) =>
              key.startsWith(`${doc.path}/`) &&
              key.split("/").length === doc.path.split("/").length + 1,
          )
          .sort(([, a], [, b]) => {
            const left = Number(a[doc.field!] ?? 0);
            const right = Number(b[doc.field!] ?? 0);
            return doc.direction === "desc" ? right - left : left - right;
          });
        return {
          docs: ordered
            .slice(0, doc.take ?? ordered.length)
            .map(([key]) => snapshot({ path: key })),
        };
      };
      const result = await run({
        get: async (doc: { path: string }) => read(doc),
        getAll: async (...docs: { path: string }[]) => docs.map(read),
        set: (doc: { path: string }, value: Record<string, unknown>) =>
          writes.push(() => rows.set(doc.path, structuredClone(value))),
        create: (doc: { path: string }, value: Record<string, unknown>) =>
          writes.push(() => {
            assert.equal(rows.has(doc.path), false);
            rows.set(doc.path, structuredClone(value));
          }),
        update: (doc: { path: string }, value: Record<string, unknown>) =>
          writes.push(() => {
            assert.ok(rows.has(doc.path));
            rows.set(doc.path, {
              ...rows.get(doc.path),
              ...structuredClone(value),
            });
          }),
        delete: (doc: { path: string }) =>
          writes.push(() => rows.delete(doc.path)),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return { rows, db };
}

function productForm(record?: CatalogRecord<"caviar">) {
  const data =
    record?.data ?? initialCaviar().find((row) => row.id === "hybrid")!.data;
  const form = new FormData();
  form.set("slug", "test-regression");
  form.set("jarImage", "/assets/img/prod/hybrid/detail-50g.webp");
  form.set("servingImage", data.copy.ua.servingImage);
  form.set("detailServingImage", data.copy.ua.detailServingImage!);
  form.set("latin", data.copy.ua.latin);
  form.set("galleryCount", "0");
  for (const locale of ["ua", "en"] as const)
    for (const [key, value] of Object.entries(data.copy[locale]))
      if (typeof value === "string") form.set(`${key}.${locale}`, value);
  for (const [key, value] of Object.entries(data.nutrition))
    form.set(`nutrition.${key}`, String(value));
  form.set("packCount", "1");
  form.set("pack.0.id", record?.data.copy.ua.variants[0]?.id ?? "");
  form.set("pack.0.weight", "125");
  form.set("pack.0.price", "1234");
  form.set("pack.0.image", "/assets/img/prod/hybrid/detail-50g.webp");
  form.set("pack.0.available", "on");
  return form;
}

test("catalogue create/edit writes source and projection atomically, preserves stock and rejects stale or invalid edits", async () => {
  const { rows, db } = database();
  const mocks = {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => db,
    },
  };
  const { saveCatalogRecord } = serverModule<
    typeof import("../../src/lib/server/catalog/save-record.ts")
  >("src/lib/server/catalog/save-record.ts", mocks);
  const { writeStock } = serverModule<
    typeof import("../../src/lib/server/catalog/inventory.ts")
  >("src/lib/server/catalog/inventory.ts", mocks);
  const source = `${catalogCollections.caviar.records}/test-item`;
  const published = `${catalogCollections.caviar.published}/test-item`;
  const form = productForm();
  form.set("latin", "test/TEST/test");
  form.set("published", "on");
  await saveCatalogRecord("caviar", null, "test-item", 0, form, "test-staff");
  let record = rows.get(source) as unknown as CatalogRecord<"caviar">;
  assert.ok(
    Object.values(record.data.stock).every((stock) => stock.quantity === 0),
  );
  const packId = record.data.copy.ua.variants[0]!.id;
  assert.equal(record.data.copy.ua.latin, "test/TEST/test");
  assert.deepEqual(rows.get(published)?.data, record.data);
  await writeStock(
    "test-item",
    packId,
    1,
    (previous) => ({ ...previous, quantity: 7 }),
    "test-staff",
  );
  assert.equal(rows.get(`${catalogSupport.inventory}/${packId}`)?.revision, 2);
  record = rows.get(source) as unknown as CatalogRecord<"caviar">;
  const edit = productForm(record);
  edit.set("name.ua", "TEST оновлено");
  edit.set("latin", "Довільна назва — №2");
  edit.set("published", "on");
  await saveCatalogRecord(
    "caviar",
    "test-item",
    "test-item",
    2,
    edit,
    "test-staff",
  );
  record = rows.get(source) as unknown as CatalogRecord<"caviar">;
  assert.equal(record.data.copy.ua.name, "TEST оновлено");
  assert.equal(record.data.copy.ua.latin, "Довільна назва — №2");
  assert.equal(record.data.stock[packId]?.quantity, 7);
  assert.deepEqual(rows.get(published)?.data, record.data);
  const before = structuredClone([...rows]);
  await assert.rejects(() =>
    saveCatalogRecord(
      "caviar",
      "test-item",
      "test-item",
      2,
      edit,
      "test-staff",
    ),
  );
  assert.deepEqual([...rows], before);
  edit.set("detailServingAlt.en", "");
  await assert.rejects(
    () =>
      saveCatalogRecord(
        "caviar",
        "test-item",
        "test-item",
        3,
        edit,
        "test-staff",
      ),
    (error: unknown) =>
      (error as { field?: string }).field === "detailServingAlt.en",
  );
  assert.deepEqual([...rows], before);
});

test("a new card is ranked after every existing one, even when the counter lags", async () => {
  const { rows, db } = database();
  const { saveCatalogRecord } = serverModule<
    typeof import("../../src/lib/server/catalog/save-record.ts")
  >("src/lib/server/catalog/save-record.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => db,
    },
  });
  const create = async (id: string) => {
    const form = productForm();
    form.set("published", "on");
    form.set("slug", id);
    await saveCatalogRecord("caviar", null, id, 0, form, "test-staff");
    return Number(
      (
        rows.get(`${catalogCollections.caviar.records}/${id}`) as {
          rank: number;
        }
      ).rank,
    );
  };

  const first = await create("first-item");
  const second = await create("second-item");
  assert.ok(second > first, "each new card ranks after the previous one");

  // A record written outside the normal path — a seed, a migration, a console
  // edit — leaves the counter behind. The next card must still land last.
  rows.set(`${catalogCollections.caviar.records}/seeded`, {
    id: "seeded",
    rank: 9999,
    published: true,
    everPublished: true,
    revision: 1,
    data: {},
  });
  const third = await create("third-item");
  assert.ok(
    third > 9999,
    `a card created after an out-of-band rank must outrank it, got ${third}`,
  );
  assert.equal(
    Number(
      (rows.get(`${catalogSupport.settings}/caviar`) as { rank: number }).rank,
    ),
    third,
    "the counter catches up so the next card does not repeat the rank",
  );
});

test("inventory failure cannot partially change source or published quantities", async () => {
  const { rows, db } = database();
  const record = initialCaviar()[0]!;
  const packId = record.data.copy.ua.variants[0]!.id;
  const source = `${catalogCollections.caviar.records}/${record.id}`;
  rows.set(source, record as unknown as Record<string, unknown>);
  const { writeStock } = serverModule<
    typeof import("../../src/lib/server/catalog/inventory.ts")
  >("src/lib/server/catalog/inventory.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => db,
    },
  });
  const before = structuredClone([...rows]);
  await assert.rejects(() =>
    writeStock(
      record.id,
      packId,
      record.revision,
      () => {
        throw new Error("invalid batch");
      },
      "test-staff",
    ),
  );
  assert.deepEqual([...rows], before);
});

test("zeroing a batch clears its stock but cannot remove units reserved by an order", () => {
  const { stockInput } = serverModule<
    typeof import("../../src/lib/server/catalog/stock-form.ts")
  >("src/lib/server/catalog/stock-form.ts", {});
  const form = new FormData();
  form.set("batchCount", "1");
  form.set("batch.0.code", "TEST");
  form.set("batch.0.quantity", "0");
  form.set("batch.0.expiresOn", "2000-01-01");
  const previous = {
    quantity: 3,
    reserved: 0,
    batches: [{ code: "TEST", quantity: 3, expiresOn: "2000-01-01" }],
  };
  assert.deepEqual(stockInput(form, previous), {
    quantity: 0,
    reserved: 0,
    batches: [],
  });
  assert.throws(() => stockInput(form, { ...previous, reserved: 1 }));
});

test("deleting a product names the real blocker, hiding stays open, and the slug is freed", async () => {
  const { rows, db } = database();
  const record = structuredClone(initialCaviar()[0]!);
  const packId = record.data.copy.ua.variants[0]!.id;
  const source = `${catalogCollections.caviar.records}/${record.id}`;
  const slug = `${catalogSupport.slugs}/${record.data.copy.ua.slug}`;
  record.data.stock[packId] = {
    quantity: 3,
    reserved: 0,
    batches: [{ code: "TEST", quantity: 3, expiresOn: "2030-01-01" }],
  };
  rows.set(source, record as unknown as Record<string, unknown>);
  rows.set(`${catalogCollections.caviar.published}/${record.id}`, {
    ...record,
  } as unknown as Record<string, unknown>);
  rows.set(slug, { productId: record.id });
  const { writeCatalogVisibility } = serverModule<
    typeof import("../../src/lib/server/catalog/visibility.ts")
  >("src/lib/server/catalog/visibility.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => db,
    },
  });

  // Stock on hand refuses deletion, but says which blocker it is.
  await assert.rejects(
    () =>
      writeCatalogVisibility(
        "caviar",
        record.id,
        record.revision,
        "delete",
        "test-staff",
      ),
    (error: unknown) => (error as { reason?: string }).reason === "stock",
  );
  assert.ok(rows.has(source));

  // A reservation is a different answer for staff, so it is named separately.
  rows.set(source, {
    ...record,
    data: {
      ...record.data,
      stock: {
        ...record.data.stock,
        [packId]: { quantity: 3, reserved: 1, batches: [] },
      },
    },
  } as unknown as Record<string, unknown>);
  await assert.rejects(
    () =>
      writeCatalogVisibility(
        "caviar",
        record.id,
        record.revision,
        "delete",
        "test-staff",
      ),
    (error: unknown) => (error as { reason?: string }).reason === "reserved",
  );

  // The way out of both: hiding a product that still has stock must work.
  rows.set(source, record as unknown as Record<string, unknown>);
  await writeCatalogVisibility(
    "caviar",
    record.id,
    record.revision,
    "hide",
    "test-staff",
  );
  const hidden = rows.get(source) as unknown as CatalogRecord<"caviar">;
  assert.equal(hidden.published, false);
  assert.equal(hidden.everPublished, true);
  assert.equal(hidden.data.stock[packId]?.quantity, 3);

  // Written off, the record goes — and releases its slug claim with it.
  rows.set(source, {
    ...hidden,
    data: {
      ...hidden.data,
      stock: {
        ...hidden.data.stock,
        [packId]: { quantity: 0, reserved: 0, batches: [] },
      },
    },
  } as unknown as Record<string, unknown>);
  await writeCatalogVisibility(
    "caviar",
    record.id,
    hidden.revision,
    "delete",
    "test-staff",
  );
  assert.equal(rows.has(source), false);
  assert.equal(rows.has(slug), false);
});
