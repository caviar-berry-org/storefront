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
  analyticsWindow,
  channelShares,
  type AnalyticsPeriod,
} from "@/domain/analytics-window";
import { errorLabel, indexRequired } from "./observability";

const revalidate = 60;

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
    let expired = 0;
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
        expired += pack.batches.filter(
          ({ expiresOn }) => expiresOn < today,
        ).length;
      }
    }
    return { expiring, expired, low, at: Date.now() };
  },
  [
    "staff-dashboard-inventory-v1",
    process.env.APP_ENV ?? "",
    process.env.FIREBASE_PROJECT_ID ?? "",
  ],
  { revalidate },
);

async function withDeadline<T>(request: Promise<T>): Promise<T> {
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
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Orders and revenue per acquisition channel over one reporting window.
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
        const result = await orderCollection()
          .where("attribution.source", "==", source)
          .where("createdAt", ">=", from)
          .where("createdAt", "<", to)
          .aggregate({
            count: AggregateField.count(),
            total: AggregateField.sum("totalMinor"),
          })
          .get();
        return { source, ...result.data() };
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
    "staff-dashboard-channels-v2",
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
