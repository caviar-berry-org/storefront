"use server";

import {
  isOrderTrendPeriod,
  type OrderTrendBucket,
  type OrderTrendWindow,
} from "@/domain/order-metrics";
import { readOrderTrend } from "@/lib/server/dashboard-metrics";
import { getStaffSession } from "@/lib/server/staff-session";

export type OrderTrendData = {
  buckets: OrderTrendBucket[];
  window: OrderTrendWindow;
  at: number;
};

export type OrderTrendResult =
  OrderTrendData | { error: "session" | "invalid" | "unavailable" };

/**
 * One window of the dashboard trend, fetched when a staff member asks for it.
 *
 * The panel keeps every window it has already loaded, so switching back to one
 * costs nothing; a window asked for twice inside a minute is answered from the
 * server cache without touching Firestore either.
 */
export async function queryOrderTrend(
  period: unknown,
): Promise<OrderTrendResult> {
  if (!(await getStaffSession())) return { error: "session" };
  if (!isOrderTrendPeriod(period)) return { error: "invalid" };
  const trend = await readOrderTrend(period);
  if (!trend) return { error: "unavailable" };
  return { buckets: trend.buckets, window: trend.window, at: trend.at };
}
