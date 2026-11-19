import "server-only";

import { AggregateField } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { catalogCollections } from "@/lib/catalog-collections";
import { kyivDate } from "@/domain/inquiry";
import {
  inventoryExpiryWindowEnd,
  isLowInventory,
} from "@/domain/inventory-alerts";
import type { CaviarData } from "@/domain/managed-catalog";
import { firebaseAdminDatabase } from "./firestore";
import { orderCollection } from "./orders/storage";
import { utmSources } from "@/domain/attribution";
import {
  groupOrderCounts,
  orderTrendWindow,
  orderTrendWindowFrom,
  type OrderTrendBucket,
  type OrderTrendPeriod,
} from "@/domain/order-metrics";
import {
  analyticsWindow,
  channelShares,
  type AnalyticsPeriod,
} from "@/domain/analytics-window";
import { errorLabel, indexRequired } from "./observability";

/**
 * Five minutes, not one.
 *
 * This cache is shared by every staff member and every tab, and it refreshes
 * only when someone actually opens the page — so the window is what decides
 * how often Firestore is touched at all. A dashboard figure five minutes old
 * costs nothing in practice: the authoritative records are the order list and
 * the inventory pages, which are never read through here. The panels print
 * the moment of the snapshot, so the number is always labelled with its age.
 */
const revalidate = 300;

const completedOrders = unstable_cache(
  async () => {
    const result = await orderCollection()
      .where("status", "==", "received")
      .aggregate({
        count: AggregateField.count(),
        total: AggregateField.sum("totalMinor"),
      })
      .get();
    return { ...result.data(), at: Date.now() };
  },
  [
    "staff-dashboard-completed-v1",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

const completedDiscounts = unstable_cache(
  async () => {
    const result = await orderCollection()
      .where("status", "==", "received")
      .aggregate({ discount: AggregateField.sum("discountMinor") })
      .get();
    return { ...result.data(), at: Date.now() };
  },
  [
    "staff-dashboard-discounts-v2",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

const inventoryAlerts = unstable_cache(
  async (today: string) => {
    const warningDate = inventoryExpiryWindowEnd(today);
    const snapshot = await firebaseAdminDatabase()
      .collection(catalogCollections.caviar.records)
      .select("data.stock", "data.copy.ua.variants")
      .get();
    let expiring = 0;
    let low = 0;
    for (const doc of snapshot.docs) {
      const { copy, stock } = doc.get("data") as CaviarData;
      for (const variant of copy.ua.variants) {
        const pack = stock[variant.id];
        if (!pack) continue;
        if (isLowInventory(pack, variant.available)) low++;
        if (
          pack.batches.some(
            ({ expiresOn }) => expiresOn >= today && expiresOn < warningDate,
          )
        )
          expiring++;
      }
    }
    // Batches already past their date are not a dashboard figure: they need
    // the batch, the pack and the product beside them, which is what the
    // inventory table shows. Counting them here only said "go and look".
    return { expiring, low, at: Date.now() };
  },
  [
    "staff-dashboard-inventory-v2",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

async function withDeadline<T>(request: Promise<T>, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Object.assign(new Error("Dashboard query timed out"), {
                code: 4,
              }),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Aggregations run in rounds rather than all at once. A sixty-day window asks
 * for 150 of them, and firing every one onto the gRPC channel together queues
 * them anyway while making a single slow reply look like a total outage.
 */
async function inRounds<T>(jobs: readonly (() => Promise<T>)[], size: number) {
  const results: T[] = [];
  for (let start = 0; start < jobs.length; start += size)
    results.push(
      ...(await Promise.all(
        jobs.slice(start, start + size).map((job) => job()),
      )),
    );
  return results;
}

/**
 * Orders and received money per acquisition channel over one reporting window.
 *
 * One count-and-sum aggregation per source rather than a scan: an aggregation
 * bills a fraction of the documents it covers, so the cost stays flat as the
 * order book grows, while reading the documents would not. Only the window the
 * staff member is looking at is queried, and the result is cached per window.
 */
const channelOrders = unstable_cache(
  async (period: AnalyticsPeriod, from: number, to: number) => {
    // One source failing must not blank the whole panel.
    const results = await Promise.allSettled(
      utmSources.map(async (source) => {
        const window = orderCollection()
          .where("attribution.source", "==", source)
          .where("createdAt", ">=", from)
          .where("createdAt", "<", to);
        // Counted: every tagged order. Credited: only payments that arrived.
        const [placed, received] = await Promise.all([
          window.aggregate({ count: AggregateField.count() }).get(),
          window
            .where("payment.status", "==", "paid")
            .aggregate({ total: AggregateField.sum("totalMinor") })
            .get(),
        ]);
        return {
          source,
          count: placed.data().count,
          total: received.data().total,
        };
      }),
    );
    const failure = results.find((result) => result.status === "rejected");
    // The composite index is deployed separately from the app, so an admin
    // opening this before `firebase deploy --only firestore:indexes` must be
    // told that, not shown a generic outage.
    if (failure && indexRequired(failure.reason))
      return {
        period,
        rows: [],
        orders: 0,
        revenue: 0,
        indexRequired: true as const,
        at: Date.now(),
      };
    if (failure) throw failure.reason;
    return {
      period,
      ...channelShares(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      ),
      indexRequired: false as const,
      at: Date.now(),
    };
  },
  [
    // v3: the money column counts received payments, not placed orders.
    "staff-dashboard-channels-v3",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

export type ChannelMetrics = Awaited<ReturnType<typeof channelOrders>>;

export async function readChannelMetrics(period: AnalyticsPeriod) {
  const window = analyticsWindow(period);
  try {
    // The window is part of the cache key, so a cached answer always describes
    // the days its label names, even as the day rolls over in Kyiv.
    const metrics = await withDeadline(
      channelOrders(period, window.from, window.to),
    );
    return { ...metrics, window };
  } catch (error) {
    // Name the error. A log that prints an empty object is the same as no log.
    console.error("[staff.dashboard]", {
      query: "channels",
      period,
      cause: errorLabel(error),
      message: error instanceof Error ? error.message.slice(0, 300) : undefined,
    });
    return null;
  }
}

export async function readDashboardMetrics(includeInventory: boolean) {
  const results = await Promise.allSettled([
    withDeadline(completedOrders()),
    withDeadline(completedDiscounts()),
    includeInventory
      ? withDeadline(inventoryAlerts(kyivDate()))
      : Promise.resolve(null),
  ]);
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") continue;
    const error: unknown = result.reason;
    const code =
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "number"
        ? error.code
        : undefined;
    console.error("[staff.dashboard]", {
      query: ["orders", "discounts", "inventory"][index],
      code,
    });
  }
  const [orders, discounts, inventory] = results;
  const dates = results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value.at] : [],
  );
  return {
    orders: orders.status === "fulfilled" ? orders.value : null,
    discounts: discounts.status === "fulfilled" ? discounts.value : null,
    inventory: inventory.status === "fulfilled" ? inventory.value : null,
    at: dates.length ? Math.min(...dates) : null,
  };
}

/** Queries per bucket: the window total plus the three counted status groups. */
const trendRound = 30;

/**
 * Orders per bucket over one window, grouped by what became of them.
 *
 * The x axis is the day an order was *created*, and each line is its status
 * today — orders carry no status history, so "how many sat in processing last
 * Tuesday" is not a question this data can answer. A bucket therefore keeps
 * changing shape as its orders move on, which is exactly what makes the recent
 * end of the chart useful and the far end stable.
 *
 * Counted with aggregations rather than by reading the window: an aggregation
 * bills a fraction of the documents it covers, so a busy month costs the same
 * as a quiet one. `status + createdAt` is already indexed for the order list.
 */
const orderTrend = unstable_cache(
  async (period: OrderTrendPeriod, firstDay: string) => {
    const window = orderTrendWindowFrom(period, firstDay);
    const orders = orderCollection();
    const countOf = async (
      range: { from: number; to: number },
      status?: string,
    ) => {
      let query: FirebaseFirestore.Query = orders
        .where("createdAt", ">=", range.from)
        .where("createdAt", "<", range.to);
      // Ordered the way the order list already is, so these counts reuse the
      // deployed `status + createdAt DESC` index. Without the explicit order a
      // range filter asks for ascending, which would mean a second composite
      // index charged against every order write for no extra answer.
      if (status)
        query = query
          .where("status", "==", status)
          .orderBy("createdAt", "desc");
      return (await query.count().get()).data().count;
    };
    // `new`, `received`, `cancelled` and `dispute` are asked for by name; the
    // rest of the total is work in progress. Counting the open statuses
    // instead would quietly drop any status added to the lifecycle later.
    const counted = ["new", "received", "cancelled", "dispute"] as const;
    const numbers = await inRounds(
      window.buckets.flatMap((range) => [
        () => countOf(range),
        ...counted.map((status) => () => countOf(range, status)),
      ]),
      trendRound,
    );
    const stride = counted.length + 1;
    const buckets: OrderTrendBucket[] = window.buckets.map((range, index) => {
      const at = index * stride;
      return {
        ...range,
        counts: groupOrderCounts(numbers[at]!, {
          new: numbers[at + 1]!,
          received: numbers[at + 2]!,
          cancelled: numbers[at + 3]!,
          dispute: numbers[at + 4]!,
        }),
      };
    });
    return { period, buckets, at: Date.now() };
  },
  [
    "staff-dashboard-order-trend-v1",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

export type OrderTrend = Awaited<ReturnType<typeof orderTrend>> & {
  window: ReturnType<typeof orderTrendWindow>;
};

export async function readOrderTrend(
  period: OrderTrendPeriod,
): Promise<OrderTrend | null> {
  const window = orderTrendWindow(period);
  try {
    // Sixty days are five rounds of aggregations, so this one window gets a
    // longer deadline than the single-query panels.
    const trend = await withDeadline(
      orderTrend(period, window.firstDay),
      12000,
    );
    return { ...trend, window };
  } catch (error) {
    console.error("[staff.dashboard]", {
      query: "orderTrend",
      period,
      cause: errorLabel(error),
      message: error instanceof Error ? error.message.slice(0, 300) : undefined,
    });
    return null;
  }
}
