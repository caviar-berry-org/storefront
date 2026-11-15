import { FieldPath } from "firebase-admin/firestore";
import type { CustomerSummary } from "@/domain/customer-directory";
import { staffCopy } from "@/i18n/staff-uk";
import { firebaseAdminDatabase } from "@/lib/server/firestore";
import { getStaffSession } from "@/lib/server/staff-session";
import { workbook } from "@/lib/server/workbook";

export const runtime = "nodejs";
export const maxDuration = 60;

const batch = 500;
const copy = staffCopy.customerDirectory;
const kyiv = (value: unknown) =>
  typeof value === "number"
    ? new Date(value).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })
    : copy.noValue;

export async function GET() {
  if (!(await getStaffSession())) return new Response(null, { status: 401 });
  try {
    let query: FirebaseFirestore.Query = firebaseAdminDatabase()
      .collection("customers")
      .orderBy("lastInteractionAt", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    const rows: unknown[][] = [
      [
        copy.customer,
        "Email",
        copy.phone,
        copy.segments,
        copy.orders,
        copy.lastInteraction,
        copy.sources,
      ],
    ];
    while (true) {
      const page = await query
        .limit(batch)
        .select(
          "name",
          "email",
          "phone",
          "type",
          "orderCount",
          "sources",
          "lastInteractionAt",
        )
        .get();
      for (const doc of page.docs) {
        const customer = doc.data() as Omit<CustomerSummary, "id">;
        rows.push([
          customer.name || copy.noValue,
          customer.email || copy.noValue,
          customer.phone || copy.noValue,
          copy.types[customer.type] ?? copy.noValue,
          customer.orderCount ?? 0,
          kyiv(customer.lastInteractionAt),
          (customer.sources ?? [])
            .map((source) => copy.kinds[source] ?? source)
            .join(", ") || copy.noValue,
        ]);
      }
      if (page.size < batch) break;
      query = query.startAfter(page.docs.at(-1)!);
    }
    return new Response(
      new Uint8Array(workbook(rows, staffCopy.sections.customers)),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="customers.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(copy.unavailable, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
