import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";

/**
 * The orders action guards the search string itself before handing it to the
 * query. Both must agree on what a searchable term is: the directory and the
 * query already use `orderSearchTerm`, and a guard that disagrees rejects every
 * printed order number before Firestore is ever asked. The domain tests cannot
 * see that — the mismatch lives between them.
 */
function actions(onRead: (filters: unknown, cursor: unknown) => void) {
  const noop = () => {};
  return serverModule<
    typeof import("../../src/app/(staff)/admin/orders/actions.ts")
  >("src/app/(staff)/admin/orders/actions.ts", {
    "next/server": { after: noop },
    "next/cache": { revalidatePath: noop },
    [resolve("src/lib/server/staff-session.ts")]: {
      getStaffSession: async () => ({ uid: "staff-1", name: "Staff" }),
    },
    [resolve("src/lib/server/orders/queries.ts")]: {
      readOrders: async (filters: unknown, cursor: unknown) => {
        onRead(filters, cursor);
        return { rows: [], next: null };
      },
    },
    [resolve("src/lib/server/orders/tracking.ts")]: { saveTracking: noop },
    [resolve("src/lib/server/orders/storage.ts")]: {
      orderCollection: noop,
      orderData: noop,
    },
    [resolve("src/lib/server/orders/update.ts")]: { changeOrder: noop },
    [resolve("src/lib/server/orders/feedback.ts")]: {
      orderFailure: () => "technical",
    },
    [resolve("src/lib/server/orders/notifications.ts")]: {
      deliverOrderNotifications: noop,
    },
    [resolve("src/lib/server/payments/mono.ts")]: { monoInvoiceStatus: noop },
    [resolve("src/lib/server/checkout/payment.ts")]: {
      applyPayment: noop,
      reconcileOrder: noop,
    },
  });
}

test("staff can search orders by printed number, not only by contact", async () => {
  const seen: string[] = [];
  const { queryOrders } = actions((filters) =>
    seen.push((filters as { search: string }).search),
  );
  const filters = (search: string) =>
    ({ search, type: "all", status: "all" }) as never;

  for (const search of [
    "CB-20261112-BE0450AC", // pasted whole, the way staff copy it
    "cb-20261112-be0450ac",
    " 1507103D ", // read out over the phone, tail alone
    "0671234567", // contact search must keep working
    "name@example.com",
    "", // the unfiltered list
  ]) {
    const result = await queryOrders(filters(search), null);
    assert.ok(
      !("error" in result),
      `${JSON.stringify(search)} was refused: ${JSON.stringify(result)}`,
    );
  }
  assert.equal(seen.length, 6);
});

test("the orders action still refuses what cannot be searched", async () => {
  let reads = 0;
  const { queryOrders } = actions(() => reads++);
  const filters = (search: string) =>
    ({ search, type: "all", status: "all" }) as never;

  for (const search of ["ab", "drop table orders", "a".repeat(255)])
    assert.deepEqual(
      await queryOrders(filters(search), null),
      { error: "invalid" },
      search.slice(0, 20),
    );
  assert.deepEqual(
    await queryOrders(filters("") as never, { id: "nope", createdAt: -1 }),
    { error: "invalid" },
  );
  assert.equal(reads, 0);
});
