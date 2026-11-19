import "server-only";

import { formatMoney } from "@/lib/format-money";
import { ordersCopy } from "@/i18n/orders-staff-uk";
import { firebaseAdminDatabase } from "../firestore";
import { orderCollection } from "../orders/storage";
import { notify } from "./telegram";

/**
 * Periodic summary of what the shop actually did, counted from records that
 * already exist. Nothing is written to keep a tally: a counter document would
 * cost a Firestore write per event, and the point of the summary is the shape
 * of the day, not a precise audit.
 *
 * What it therefore cannot report: crashes and refused limits, which live only
 * in the platform log. Those arrive the moment they happen, as their own alert.
 */

/** Bounds the reads. A day that exceeds this is news in itself, so say so. */
const scanLimit = 500;

const statusLabel = (status: string) =>
  ordersCopy.statuses[status as keyof typeof ordersCopy.statuses] ?? status;

async function countSince(since: number) {
  const db = firebaseAdminDatabase();
  const [orders, inquiries] = await Promise.all([
    orderCollection(db)
      .where("createdAt", ">=", since)
      .select("status", "totalMinor", "payment.status")
      .limit(scanLimit)
      .get(),
    db
      .collection("inquiries")
      .where("createdAt", ">=", since)
      .select("kind")
      .limit(scanLimit)
      .get(),
  ]);
  const byStatus = new Map<string, number>();
  let revenueMinor = 0;
  let awaitedMinor = 0;
  let awaited = 0;
  for (const doc of orders.docs) {
    const status = String(doc.get("status") ?? "new");
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const total = Number(doc.get("totalMinor")) || 0;
    // Money that arrived, and nothing else: a placed order is not revenue.
    // Cancelled belongs to neither figure — it happened, and it is over.
    if (doc.get("payment.status") === "paid") revenueMinor += total;
    else if (status !== "cancelled") {
      awaited++;
      awaitedMinor += total;
    }
  }
  return {
    orders: orders.docs.length,
    inquiries: inquiries.docs.length,
    revenueMinor,
    awaited,
    awaitedMinor,
    byStatus,
    truncated:
      orders.docs.length >= scanLimit || inquiries.docs.length >= scanLimit,
  };
}

export async function sendDigest(
  title: string,
  windowMs: number,
  throttleKey: string,
) {
  const counted = await countSince(Date.now() - windowMs);
  const breakdown = [...counted.byStatus.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${statusLabel(status)} ${count}`)
    .join(" · ");
  await notify(
    "daily",
    title,
    {
      Замовлень: counted.orders,
      Оплачено: formatMoney(counted.revenueMinor, "ua"),
      ...(counted.awaited && {
        "Очікує оплати": `${counted.awaited} на ${formatMoney(counted.awaitedMinor, "ua")}`,
      }),
      Статуси: breakdown,
      Заявок: counted.inquiries,
      ...(counted.truncated && {
        Увага: `показано не більше ${scanLimit} записів`,
      }),
    },
    { throttleKey },
  );
}

/** Kyiv weekday, so the weekly summary lands on a Monday for the operator. */
const kyivWeekday = (date = new Date()) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
  }).format(date);

/**
 * Called once a day by reconciliation. The platform fires that job at an
 * arbitrary moment inside its hour, so the window is "the last 24 hours"
 * rather than a calendar day — it is the honest description of what is counted.
 */
export async function sendScheduledDigests() {
  await sendDigest("За останню добу", 86_400_000, "digest-daily");
  if (kyivWeekday() === "Mon")
    await sendDigest("За останній тиждень", 7 * 86_400_000, "digest-weekly");
}
