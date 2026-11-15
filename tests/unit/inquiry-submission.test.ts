import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";

function fixture() {
  const rows = new Map<string, Record<string, unknown>>();
  let fail = false;
  const ref = (path: string) => ({
    path,
    id: path.split("/").at(-1)!,
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string) => ({
    doc: (id: string) => ref(`${path}/${id}`),
    where: (field: string, _op: string, value: string) => ({
      limit: () => ({ path, field, value, query: true }),
    }),
  });
  const snapshot = (doc: ReturnType<typeof ref>) => ({
    ref: doc,
    exists: rows.has(doc.path),
    data: () => structuredClone(rows.get(doc.path)),
    get: (field: string) => rows.get(doc.path)?.[field],
  });
  const db = {
    collection,
    runTransaction: async (run: (tx: unknown) => Promise<void>) => {
      const writes: (() => void)[] = [];
      const tx = {
        get: async (
          doc: ReturnType<typeof ref> & {
            query?: boolean;
            field?: string;
            value?: string;
          },
        ) => {
          assert.equal(
            writes.length,
            0,
            "all transaction reads precede writes",
          );
          if (doc.query)
            return {
              docs: [...rows.entries()]
                .filter(
                  ([key, data]) =>
                    key.startsWith(`${doc.path}/`) &&
                    key.split("/").length === 2 &&
                    (data[doc.field!] as string[] | undefined)?.includes(
                      doc.value!,
                    ),
                )
                .slice(0, 1)
                .map(([key]) => snapshot(ref(key))),
            };
          return snapshot(doc);
        },
        create: (doc: ReturnType<typeof ref>, data: Record<string, unknown>) =>
          writes.push(() => {
            assert.ok(!rows.has(doc.path));
            rows.set(doc.path, structuredClone(data));
          }),
        set: (
          doc: ReturnType<typeof ref>,
          data: Record<string, unknown>,
          options?: { merge: boolean },
        ) =>
          writes.push(() =>
            rows.set(doc.path, {
              ...(options?.merge ? rows.get(doc.path) : {}),
              ...structuredClone(data),
            }),
          ),
      };
      await run(tx);
      if (fail) throw new Error("service unavailable");
      writes.forEach((write) => write());
    },
  };
  const mocks = {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => db,
    },
  };
  return {
    rows,
    mocks,
    unavailable: () => {
      fail = true;
    },
  };
}

const request = {
  kind: "write" as const,
  subject: "Contact",
  name: "Test Customer",
  contact: "test@example.com",
  comment: "A question",
  date: "",
  consent: true,
};
test("inquiry and customer activity commit once; retries preserve identity and conflicting payloads fail", async () => {
  const f = fixture();
  const service = serverModule<
    typeof import("../../src/lib/server/inquiry-submission.ts")
  >("src/lib/server/inquiry-submission.ts", f.mocks);
  await service.saveInquiry(request, "request-1", "127.0.0.1");
  await service.saveInquiry(request, "request-1", "127.0.0.1");
  assert.equal(
    [...f.rows.keys()].filter((key) => key.startsWith("inquiries/")).length,
    1,
  );
  assert.equal(
    [...f.rows.keys()].filter((key) => key.includes("/activity/")).length,
    1,
  );
  assert.equal(f.rows.get("inquiries/request-1")?.marketingConsent, false);
  await assert.rejects(
    service.saveInquiry(
      { ...request, comment: "Changed" },
      "request-1",
      "127.0.0.1",
    ),
    service.InquiryConflict,
  );
  const promotion = serverModule<
    typeof import("../../src/lib/server/promotion-customer.ts")
  >("src/lib/server/promotion-customer.ts", f.mocks);
  await promotion.recordPromotionCustomer(request.contact);
  await promotion.recordPromotionCustomer(request.contact);
  const customers = [...f.rows.entries()].filter(
    ([key]) => key.startsWith("customers/") && key.split("/").length === 2,
  );
  assert.equal(customers.length, 1);
  assert.deepEqual(customers[0]![1].sources, ["contact", "promotion"]);
  assert.equal(
    [...f.rows.keys()].filter((key) => key.includes("/activity/")).length,
    2,
  );
});

test("a failed commit cannot create a success record or partial customer", async () => {
  const f = fixture();
  f.unavailable();
  const service = serverModule<
    typeof import("../../src/lib/server/inquiry-submission.ts")
  >("src/lib/server/inquiry-submission.ts", f.mocks);
  await assert.rejects(service.saveInquiry(request, "request-1", "127.0.0.1"));
  assert.equal(f.rows.size, 0);
});

test("new inquiry requests are rate limited while an idempotent retry remains safe", async () => {
  const f = fixture();
  const service = serverModule<
    typeof import("../../src/lib/server/inquiry-submission.ts")
  >("src/lib/server/inquiry-submission.ts", f.mocks);
  for (let i = 0; i < 20; i++)
    await service.saveInquiry(request, `request-${i}`, "127.0.0.1");
  await assert.rejects(
    service.saveInquiry(request, "request-21", "127.0.0.1"),
    service.InquiryLimit,
  );
  await service.saveInquiry(request, "request-0", "127.0.0.1");
  assert.equal(
    [...f.rows.keys()].filter((key) => key.startsWith("inquiries/")).length,
    20,
  );
});

test("public inquiry route rejects bots and invalid fields; only persisted requests receive success", async () => {
  let saved = 0;
  let fail = false;
  class InquiryLimit extends Error {}
  class InquiryConflict extends Error {}
  const { POST } = serverModule<
    typeof import("../../src/app/api/inquiries/route.ts")
  >("src/app/api/inquiries/route.ts", {
    "next/server": { after: () => {} },
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    [resolve("src/lib/server/inquiry-submission.ts")]: {
      InquiryLimit,
      InquiryConflict,
      saveInquiry: async (
        _input: unknown,
        _requestId: string,
        _address: string,
        attribution?: unknown,
      ) => {
        if (fail) throw new Error("offline");
        // No cookie on this visit, so no channel is recorded.
        assert.equal(attribution, undefined);
        saved++;
      },
    },
    [resolve("src/lib/server/catalog/storefront.ts")]: {
      managedCatalogEnabled: () => false,
    },
  });
  const send = (data: unknown, origin = "http://localhost:3000") =>
    POST(
      new Request("http://localhost:3000/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin,
          "Idempotency-Key": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(data),
      }),
    );
  assert.equal((await send(request, "https://other.example")).status, 400);
  assert.equal((await send({ ...request, website: "bot" })).status, 400);
  const invalid = await send({
    ...request,
    name: "",
    contact: "bad",
    consent: false,
  });
  assert.equal(invalid.status, 422);
  assert.deepEqual(Object.keys((await invalid.json()).errors).sort(), [
    "consent",
    "contact",
    "name",
  ]);
  assert.equal(saved, 0);
  assert.deepEqual(await (await send(request)).json(), { accepted: true });
  assert.equal(saved, 1);
  fail = true;
  assert.equal((await send(request)).status, 503);
  assert.equal(saved, 1);
});
