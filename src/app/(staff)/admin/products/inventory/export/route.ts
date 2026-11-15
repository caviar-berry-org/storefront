import { FieldPath } from "firebase-admin/firestore";
import {
  batchTotal,
  unbatchedQuantity,
  type CatalogRecord,
} from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { catalogCollections } from "@/lib/catalog-collections";
import { catalogStaff } from "@/lib/server/catalog/access";
import { firebaseAdminDatabase } from "@/lib/server/firestore";
import { getStaffSession } from "@/lib/server/staff-session";
import { workbook } from "@/lib/server/workbook";

export const runtime = "nodejs";
export const maxDuration = 60;

const batch = 200;

export async function GET() {
  if (!(await getStaffSession())) return new Response(null, { status: 401 });
  if (!(await catalogStaff()))
    return new Response(copy.errors.denied, { status: 403 });
  try {
    let query: FirebaseFirestore.Query = firebaseAdminDatabase()
      .collection(catalogCollections.caviar.records)
      .orderBy("rank")
      .orderBy(FieldPath.documentId());
    const rows: unknown[][] = [
      [
        staffCopy.sections.caviar,
        copy.weight,
        copy.quantity,
        copy.reserved,
        copy.outsideReserve,
        copy.batch,
        copy.batchQuantity,
        copy.expiry,
        copy.published,
      ],
    ];
    while (true) {
      const page = await query
        .limit(batch)
        .select(
          "rank",
          "published",
          "data.copy.ua.name",
          "data.copy.ua.variants",
          "data.stock",
        )
        .get();
      for (const doc of page.docs) {
        const { data, published } = doc.data() as CatalogRecord<"caviar">;
        const { name, variants } = data.copy.ua;
        for (const pack of variants) {
          const stock = data.stock[pack.id];
          const quantity = stock?.quantity;
          const batches = stock?.batches ?? [];
          // One row per batch keeps codes and dates filterable in Excel;
          // a pack with no batches still appears with its own totals.
          const lines: [string, unknown, unknown][] = batches.length
            ? batches.map((item) => [
                item.code,
                item.quantity,
                item.expiresOn || copy.notSet,
              ])
            : [[copy.unbatched, quantity ?? copy.notSet, copy.notSet]];
          for (const [code, units, expiry] of lines)
            rows.push([
              name,
              `${pack.weightGrams} ${copy.gramsShort}`,
              quantity ?? copy.notSet,
              stock?.reserved ?? 0,
              stock ? unbatchedQuantity(stock) : copy.notSet,
              code,
              units,
              expiry,
              pack.available ? copy.availableYes : copy.availableNo,
            ]);
          if (batches.length > 1)
            rows.push([
              name,
              `${pack.weightGrams} ${copy.gramsShort}`,
              quantity ?? copy.notSet,
              stock?.reserved ?? 0,
              stock ? unbatchedQuantity(stock) : copy.notSet,
              copy.batchesTotal,
              batchTotal(batches),
              "",
              published ? copy.availableYes : copy.availableNo,
            ]);
        }
      }
      if (page.size < batch) break;
      query = query.startAfter(page.docs.at(-1)!);
    }
    return new Response(
      new Uint8Array(workbook(rows, staffCopy.sections.inventory)),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="inventory.xlsx"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response(copy.errors.unavailable, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
