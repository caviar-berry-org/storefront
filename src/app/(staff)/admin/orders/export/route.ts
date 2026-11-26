import { FieldPath } from "firebase-admin/firestore";
import { catalogStaffCopy as catalog } from "@/i18n/catalog-staff-uk";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { orderCollection } from "@/lib/server/orders/storage";
import { getStaffSession } from "@/lib/server/staff-session";
import { workbookSheets } from "@/lib/server/workbook";
import type { Order, OrderLine } from "@/domain/orders";

export const runtime = "nodejs";
export const maxDuration = 60;

const batch = 500;
const kyiv = (value: unknown) =>
  typeof value === "number"
    ? new Date(value).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })
    : copy.none;
const amount = (minor: unknown) =>
  typeof minor === "number" ? (minor / 100).toFixed(2) : copy.none;
const day = (value: string) => value.split("-").reverse().join(".");
const pack = (line: OrderLine) => `${line.weightGrams} ${copy.weight}`;

/**
 * One cell per order, so the orders sheet keeps one row per order and its
 * money column stays summable. Semicolons, not newlines: the workbook ships
 * without a style part, so a wrapped cell would render as one line anyway.
 */
const composition = (lines: OrderLine[] | undefined) =>
  lines?.length
    ? lines
        .map(
          (line) =>
            `${line.name} · ${pack(line)} × ${line.quantity} ${copy.unit}`,
        )
        .join("; ")
    : copy.none;

/**
 * Rows for the positions sheet. Batches are written only once stock is
 * consumed — at creation for transfers, at confirmed payment for card orders —
 * so an order still awaiting payment reports no batch rather than a guessed
 * one. Quantity, price and line total sit on the line's first row only; a line
 * split across batches must not count its money twice.
 */
function positions(line: OrderLine): unknown[][] {
  const taken = line.batches ?? [];
  const covered = taken.reduce((sum, item) => sum + item.quantity, 0);
  const batches: [unknown, unknown, unknown][] = taken.map((item) => [
    item.code,
    item.quantity,
    item.expiresOn ? day(item.expiresOn) : catalog.notSet,
  ]);
  if (line.batches === undefined)
    batches.push([copy.none, copy.none, copy.none]);
  else if (covered < line.quantity)
    batches.push([catalog.unbatched, line.quantity - covered, copy.none]);
  return batches.map(([code, units, expiry], index) => [
    line.name,
    pack(line),
    index === 0 ? line.quantity : "",
    index === 0 ? amount(line.unitPriceMinor) : "",
    index === 0 ? amount(line.quantity * line.unitPriceMinor) : "",
    code,
    units,
    expiry,
  ]);
}

export async function GET() {
  if (!(await getStaffSession())) return new Response(null, { status: 401 });
  try {
    let query: FirebaseFirestore.Query = orderCollection()
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    const orders: unknown[][] = [
      [
        copy.number,
        copy.date,
        copy.status,
        copy.type,
        copy.customer,
        "Email",
        "Телефон",
        staffCopy.customerDirectory.segments,
        copy.promo,
        copy.total,
        copy.payment,
        copy.subtotal,
        copy.discount,
        copy.shipping,
        `${copy.delivery} — ${copy.method}`,
        copy.city,
        copy.destination,
        copy.tracking,
        copy.items,
      ],
    ];
    const lines: unknown[][] = [
      [
        copy.number,
        copy.date,
        copy.status,
        "Товар",
        catalog.weight,
        "Кількість",
        catalog.price,
        "Сума позиції",
        catalog.batch,
        catalog.batchQuantity,
        catalog.expiry,
      ],
    ];
    while (true) {
      const page = await query
        .limit(batch)
        .select(
          "number",
          "createdAt",
          "status",
          "type",
          "customer",
          "totalMinor",
          "promotion",
          "subtotalMinor",
          "discountMinor",
          "shippingMinor",
          "payment.status",
          "delivery",
          "lines",
        )
        .get();
      for (const doc of page.docs) {
        const order = doc.data() as Order;
        const status = copy.statuses[order.status] ?? order.status;
        const date = kyiv(order.createdAt);
        orders.push([
          order.number,
          date,
          status,
          copy.types[order.type] ?? order.type,
          order.customer?.name || copy.none,
          order.customer?.email || copy.none,
          order.customer?.phone || copy.none,
          staffCopy.customerDirectory.types[order.customer?.type] ?? copy.none,
          order.promotion
            ? `${order.promotion.code} (${order.promotion.percent}%)`
            : copy.none,
          amount(order.totalMinor),
          copy.paymentStates[order.payment?.status] ?? copy.none,
          amount(order.subtotalMinor),
          amount(order.discountMinor),
          amount(order.shippingMinor),
          order.delivery
            ? order.delivery.method === "branch"
              ? copy.branch
              : copy.courier
            : copy.none,
          order.delivery?.city || copy.none,
          order.delivery?.destination || copy.none,
          order.delivery?.trackingNumber || copy.none,
          composition(order.lines),
        ]);
        for (const line of order.lines ?? [])
          for (const row of positions(line))
            lines.push([order.number, date, status, ...row]);
      }
      if (page.size < batch) break;
      query = query.startAfter(page.docs.at(-1)!);
    }
    return new Response(
      new Uint8Array(
        workbookSheets([
          { name: staffCopy.sections.orders, rows: orders },
          { name: copy.items, rows: lines },
        ]),
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="orders.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(copy.exportFailed, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
