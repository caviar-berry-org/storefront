import { getStaffSession } from "@/lib/server/staff-session";
import { promotionBook } from "@/lib/server/promotions/storage";
import { workbook } from "@/lib/server/workbook";
import { FieldPath } from "firebase-admin/firestore";
import { promotionsCopy as copy } from "@/i18n/promotions-staff-uk";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!(await getStaffSession())) return new Response(null, { status: 401 });
  const search = (new URL(request.url).searchParams.get("search") ?? "")
    .trim()
    .toLowerCase();
  if (
    search &&
    (search.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(search))
  )
    return new Response(copy.searchInvalid, { status: 400 });
  try {
    let q: FirebaseFirestore.Query = promotionBook().collection("issues");
    if (search) q = q.where("email", "==", search);
    q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
    const rows: unknown[][] = [
      [
        "Email",
        "Промокод",
        "Знижка, %",
        "Видано (Київ)",
        "Діє до (Київ)",
        "Стан листа",
        "Джерело",
      ],
    ];
    const date = (n: unknown) =>
      typeof n === "number"
        ? new Date(n).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })
        : "—";
    while (true) {
      const page = await q
        .limit(500)
        .select("email", "code", "percent", "createdAt", "expiresAt", "state")
        .get();
      for (const d of page.docs)
        rows.push([
          d.get("email"),
          d.get("code"),
          d.get("percent"),
          date(d.get("createdAt")),
          date(d.get("expiresAt")),
          copy.states[d.get("state") as keyof typeof copy.states] ?? "—",
          "Отримання промокоду",
        ]);
      if (page.size < 500) break;
      q = q.startAfter(page.docs.at(-1)!);
    }
    return new Response(new Uint8Array(workbook(rows, "Видачі промокодів")), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="promotion-issues.xlsx"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(copy.unavailable, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
