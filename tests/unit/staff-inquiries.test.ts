/* eslint-disable @typescript-eslint/no-explicit-any -- Minimal Firestore test adapter. */
import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";
import {
  inquiryCategory,
  inquirySearch,
  inquiryInventoryHref,
} from "../../src/domain/staff-inquiries.ts";
import {
  ownerMessage,
  restockMessage,
} from "../../src/lib/server/mail/templates.ts";
function fixture() {
  const rows = new Map<string, Record<string, any>>();
  let failCommit = false;
  let sequence = 0;
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const snap = (path: string) => ({
    id: path.split("/").at(-1)!,
    ref: ref(path),
    exists: rows.has(path),
    get: (key: string) => rows.get(path)?.[key],
    data: () => structuredClone(rows.get(path)),
  });
  let serial = Promise.resolve();
  function collection(path: string) {
    function query(
      filters: [string, string, unknown][] = [],
      orders: [string, string][] = [],
      limit = Infinity,
      cursor: any = null,
    ): any {
      return {
        doc: (id = `event-${++sequence}`) => ref(`${path}/${id}`),
        where: (key: string, op: string, value: unknown) =>
          query([...filters, [key, op, value]], orders, limit, cursor),
        orderBy: (key: string, dir = "asc") =>
          query(filters, [...orders, [key, dir]], limit, cursor),
        limit: (n: number) => query(filters, orders, n, cursor),
        startAfter: (...value: any[]) =>
          query(
            filters,
            orders,
            limit,
            value.length === 1
              ? [value[0].get("createdAt"), value[0].id]
              : value,
          ),
        get: async () => {
          let found = [...rows.entries()].filter(
            ([key, d]) =>
              key.startsWith(path + "/") &&
              key.split("/").length === path.split("/").length + 1 &&
              filters.every(([f, op, v]) =>
                op === "in"
                  ? (v as unknown[]).includes(d[f])
                  : op === "<="
                    ? d[f] <= v!
                    : d[f] === v,
              ),
          );
          found.sort(([ka, a], [kb, b]) => {
            for (const [field, dir] of orders) {
              const va = field === "__name__" ? ka : a[field],
                vb = field === "__name__" ? kb : b[field];
              if (va !== vb)
                return (va < vb ? -1 : 1) * (dir === "desc" ? -1 : 1);
            }
            return 0;
          });
          if (cursor) {
            const i = found.findIndex(
              ([key, d]) =>
                key.split("/").at(-1) === cursor[1] &&
                d.createdAt === cursor[0],
            );
            if (i >= 0) found = found.slice(i + 1);
          }
          const docs = found.slice(0, limit).map(([key]) => snap(key));
          return { docs, size: docs.length };
        },
      };
    }
    return query();
  }
  const db = {
    collection,
    runTransaction: async (fn: any) => {
      let release!: () => void;
      const prior = serial;
      serial = new Promise<void>((r) => (release = r));
      await prior;
      const writes: (() => void)[] = [];
      try {
        const result = await fn({
          get: async (r: any) => snap(r.path),
          update: (r: any, d: any) =>
            writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...d })),
          create: (r: any, d: any) =>
            writes.push(() => {
              assert(!rows.has(r.path));
              rows.set(r.path, d);
            }),
        });
        if (failCommit) throw Error("offline");
        writes.forEach((w) => w());
        return result;
      } finally {
        release();
      }
    },
    batch: () => {
      const writes: (() => void)[] = [];
      return {
        update: (r: any, d: any) =>
          writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...d })),
        commit: async () => {
          if (failCommit) throw Error("offline");
          writes.forEach((w) => w());
        },
      };
    },
  };
  return { rows, db, setFailure: (v: boolean) => (failCommit = v) };
}
const firestore = resolve("src/lib/server/firestore.ts");
test("inquiry categories preserve corporate/gift identity and normalize actual contact searches", () => {
  assert.equal(
    inquiryCategory({ kind: "gift", targetId: "corp" }),
    "corporate",
  );
  assert.equal(inquiryCategory({ kind: "gift", targetId: "premium" }), "gifts");
  assert.equal(inquiryCategory({ kind: "write" }), "contact");
  assert.equal(inquirySearch(" Person@Example.com "), "person@example.com");
  assert.equal(inquirySearch("bad"), null);
});
test("gift pagination skips interleaved corporate records without losing rows; opening and stale edits are safe", async () => {
  const f = fixture();
  for (let i = 1; i <= 30; i++)
    f.rows.set(`inquiries/${i}`, {
      kind: "gift",
      targetId: i % 2 ? "premium" : "corp",
      name: "Test",
      contact: "test@example.com",
      createdAt: 100 + i,
      status: "new",
    });
  const m = serverModule<
    typeof import("../../src/lib/server/inquiries/queries.ts")
  >("src/lib/server/inquiries/queries.ts", {
    [firestore]: { firebaseAdminDatabase: () => f.db },
    "firebase-admin/firestore": { FieldPath: { documentId: () => "__name__" } },
  });
  const a = await m.readInquiries("gifts");
  assert.equal(a.rows.length, 10);
  const b = await m.readInquiries("gifts", "", "all", a.next);
  assert.equal(b.rows.length, 5);
  assert.equal(new Set([...a.rows, ...b.rows].map((r) => r.id)).size, 15);
  assert.equal(b.next, null);
  const opened = await m.changeInquiry("1", "open", 0, "staff");
  assert.deepEqual(opened, { status: "viewed", revision: 1 });
  assert.deepEqual(await m.changeInquiry("1", "working", 0, "staff"), {
    error: "conflict",
  });
  await m.changeInquiry("1", "processed", 1, "staff");
  assert.equal(
    (await m.changeInquiry("1", "open", 0, "staff")).status,
    "processed",
  );
  assert.deepEqual(await m.changeInquiry("1", "new", 2, "staff"), {
    error: "invalid",
  });
  f.setFailure(true);
  await assert.rejects(m.changeInquiry("1", "cancelled", 2, "staff"));
  assert.equal(f.rows.get("inquiries/1")?.status, "processed");
});
test("a batch of letters shares one pooled connection and survives an unpoolable host", async () => {
  const previous = process.env.OWNER_EMAIL_ENABLED;
  process.env.OWNER_EMAIL_ENABLED = "true";
  try {
    const f = fixture();
    let opened = 0;
    let closed = 0;
    let pooledSends = 0;
    let ownSends = 0;
    let poolable = true;
    const jobs = (
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      purpose: "owner",
      to: "test@example.com",
      type: "write",
      fields: { name: "Test" },
      url: "https://example.com/admin",
      state: "pending",
      nextAttemptAt: 0,
      attempts: 0,
      ...overrides,
    });
    const m = serverModule<typeof import("../../src/lib/server/mail/jobs.ts")>(
      "src/lib/server/mail/jobs.ts",
      {
        [firestore]: { firebaseAdminDatabase: () => f.db },
        [resolve("src/lib/server/mail/smtp.ts")]: {
          mailbox: (x: string) => x,
          MailError: class extends Error {
            uncertain = false;
          },
          smtpTransport: (_env: unknown, pooled?: boolean) => {
            if (!poolable) throw new Error("configuration");
            assert.equal(pooled, true, "batches must ask for a pool");
            opened++;
            return { close: () => closed++ };
          },
          sendMail: async (
            _to: string,
            _message: unknown,
            _eventId: string,
            options: { transport?: unknown } = {},
          ) => {
            if (options.transport) pooledSends++;
            else ownSends++;
          },
        },
      },
    );

    for (const id of ["a", "b", "c"]) f.rows.set(`mailJobs/${id}`, jobs());
    await m.deliverMailJobs();
    // Three letters, one connection, closed when the run finishes.
    assert.equal(pooledSends, 3);
    assert.equal(ownSends, 0);
    assert.equal(opened, 1);
    assert.equal(closed, 1);

    // A host that refuses a pool must not stop the letters going out.
    poolable = false;
    for (const id of ["d", "e"]) f.rows.set(`mailJobs/${id}`, jobs());
    await m.deliverMailJobs();
    assert.equal(ownSends, 2);
    assert.equal(opened, 1);
  } finally {
    if (previous === undefined) delete process.env.OWNER_EMAIL_ENABLED;
    else process.env.OWNER_EMAIL_ENABLED = previous;
  }
});

test("mail jobs claim once, preserve unknown acceptance and never resend after a failed accepted-state write", async () => {
  const previous = process.env.OWNER_EMAIL_ENABLED;
  process.env.OWNER_EMAIL_ENABLED = "true";
  try {
    const f = fixture();
    let sent = 0;
    let mode = "ok";
    class MailError extends Error {
      uncertain = false;
    }
    const m = serverModule<typeof import("../../src/lib/server/mail/jobs.ts")>(
      "src/lib/server/mail/jobs.ts",
      {
        [firestore]: { firebaseAdminDatabase: () => f.db },
        [resolve("src/lib/server/mail/smtp.ts")]: {
          mailbox: (x: string) => x,
          MailError,
          sendMail: async () => {
            sent++;
            if (mode === "unknown") throw Error("SMTP ambiguous");
            if (mode === "persist") f.setFailure(true);
          },
        },
      },
    );
    const job = {
      purpose: "owner",
      to: "test@example.com",
      type: "write",
      fields: { name: "Test" },
      url: "https://example.com/admin",
      state: "pending",
      nextAttemptAt: 0,
      attempts: 0,
    };
    f.rows.set("mailJobs/one", { ...job });
    await Promise.all([m.deliverMailJobs(), m.deliverMailJobs()]);
    assert.equal(sent, 1);
    assert.equal(f.rows.get("mailJobs/one")?.state, "accepted");
    mode = "unknown";
    f.rows.set("mailJobs/two", { ...job });
    await m.deliverMailJobs();
    await m.deliverMailJobs();
    assert.equal(sent, 2);
    assert.equal(f.rows.get("mailJobs/two")?.state, "unknown");
    mode = "persist";
    f.rows.set("mailJobs/three", { ...job });
    await m.deliverMailJobs();
    f.setFailure(false);
    await m.deliverMailJobs();
    assert.equal(sent, 3);
    assert.equal(f.rows.get("mailJobs/three")?.state, "sending");
  } finally {
    if (previous === undefined) delete process.env.OWNER_EMAIL_ENABLED;
    else process.env.OWNER_EMAIL_ENABLED = previous;
  }
});
test("owner and customer templates escape submitted HTML and follow locale", () => {
  const owner = ownerMessage(
    "gift",
    { name: "<script>x</script>", comment: "Hello" },
    "https://example.com/admin",
  );
  assert(owner.subject.includes("Подарунковий"));
  assert(!owner.html.includes("<script>"));
  assert(owner.html.includes("&lt;script&gt;"));
  // Internal mail is sent on every submission: it stays lean and carries no artwork.
  assert.equal(owner.attachments, undefined);
  assert(!owner.html.includes("<img"));
  const en = restockMessage("en", "Anna", "https://example.com/en");
  assert(en.subject.includes("back in stock"));
  assert(en.html.includes('lang="en"'));
  // Availability copy stays generic: the per-pack trigger must not leak into the text.
  assert(en.text.includes("Anna"));
  assert(!en.text.includes("Trout"));
  assert(
    restockMessage("ua", "Оля", "https://example.com/ua").text.includes(
      "повний асортимент",
    ),
  );
});

test("restock queues only the requested available pack, once, and excludes visual fixtures", async () => {
  const previous = process.env.RESTOCK_EMAIL_ENABLED;
  process.env.RESTOCK_EMAIL_ENABLED = "true";
  try {
    const f = fixture();
    const base = {
      kind: "notify",
      status: "new",
      contact: "qa@example.com",
      name: "Test",
      createdAt: 100,
      targetId: "sterlet",
      locale: "en",
    };
    f.rows.set("inquiries/available", { ...base, variantId: "sterlet-100" });
    f.rows.set("inquiries/unavailable", { ...base, variantId: "sterlet-50" });
    f.rows.set("inquiries/demo", {
      ...base,
      variantId: "sterlet-100",
      test: true,
    });
    const m = serverModule<typeof import("../../src/lib/server/mail/jobs.ts")>(
      "src/lib/server/mail/jobs.ts",
      {
        [firestore]: { firebaseAdminDatabase: () => f.db },
        [resolve("src/lib/server/catalog/storefront.ts")]: {
          freshCaviar: async () => [
            {
              id: "sterlet",
              slug: "sterlet",
              name: "Sterlet",
              variants: [
                {
                  id: "sterlet-100",
                  available: true,
                  stockQuantity: 2,
                  weightGrams: 100,
                },
                {
                  id: "sterlet-50",
                  available: false,
                  stockQuantity: 0,
                  weightGrams: 50,
                },
              ],
            },
          ],
        },
      },
    );
    await m.queueRestockMail();
    await m.queueRestockMail();
    assert.equal(f.rows.get("mailJobs/restock-available")?.locale, "en");
    assert.equal(f.rows.get("inquiries/available")?.status, "processed");
    assert.equal(f.rows.get("inquiries/unavailable")?.status, "new");
    assert(!f.rows.has("mailJobs/restock-demo"));
    assert.equal(
      [...f.rows.keys()].filter((k) => k.startsWith("mailJobs/")).length,
      1,
    );
  } finally {
    if (previous === undefined) delete process.env.RESTOCK_EMAIL_ENABLED;
    else process.env.RESTOCK_EMAIL_ENABLED = previous;
  }
});

test("Excel export rejects an unauthenticated request before reading addresses", async () => {
  const m = serverModule<
    typeof import("../../src/app/(staff)/admin/promotions/export/route.ts")
  >("src/app/(staff)/admin/promotions/export/route.ts", {
    "@/lib/server/staff-session": { getStaffSession: async () => null },
    "@/lib/server/promotions/storage": {
      promotionBook: () => {
        throw Error("must not read");
      },
    },
  });
  assert.equal(
    (await m.GET(new Request("http://localhost/admin/promotions/export")))
      .status,
    401,
  );
});

test("inquiry stock links preserve the selected pack or gift identity", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.match(
    inquiryInventoryHref({
      id,
      category: "restock",
      targetId: "sterlet",
      variantId: "sterlet-50",
    })!,
    /inventory\/sterlet\/sterlet-50/,
  );
  assert.match(
    inquiryInventoryHref({
      id,
      category: "gifts",
      targetId: "premium",
      variantId: null,
    })!,
    /inventory\?gift=premium/,
  );
  assert.equal(
    inquiryInventoryHref({
      id,
      category: "corporate",
      targetId: "corp",
      variantId: null,
    }),
    null,
  );
});
