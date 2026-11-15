import { FieldPath } from "firebase-admin/firestore";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { orderCollection } from "@/lib/server/orders/storage";
import { getStaffSession } from "@/lib/server/staff-session";
import { workbook } from "@/lib/server/workbook";
import type { OrderSummary } from "@/domain/orders";

export const runtime = "nodejs";
export const maxDuration = 60;

const batch = 500;
const kyiv = (value: unknown) =>
  typeof value === "number"
    ? new Date(value).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })
    : copy.none;
const amount = (minor: unknown) =>
  typeof minor === "number" ? (minor / 100).toFixed(2) : copy.none;

export async function GET() {
  if (!(await getStaffSession())) return new Response(null, { status: 401 });
  try {
    let query: FirebaseFirestore.Query = orderCollection()
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    const rows: unknown[][] = [
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
        )
        .get();
      for (const doc of page.docs) {
        const order = doc.data() as OrderSummary;
        rows.push([
          order.number,
          kyiv(order.createdAt),
          copy.statuses[order.status] ?? order.status,
          copy.types[order.type] ?? order.type,
          order.customer?.name || copy.none,
          order.customer?.email || copy.none,
          order.customer?.phone || copy.none,
          staffCopy.customerDirectory.types[order.customer?.type] ?? copy.none,
          order.promotion
            ? `${order.promotion.code} (${order.promotion.percent}%)`
            : copy.none,
          amount(order.totalMinor),
        ]);
      }
      if (page.size < batch) break;
      query = query.startAfter(page.docs.at(-1)!);
    }
    return new Response(
      new Uint8Array(workbook(rows, staffCopy.sections.orders)),
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
