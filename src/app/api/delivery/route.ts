import { deliveryOptions } from "@/lib/server/delivery/nova-poshta";
import { isDeliveryRef } from "@/domain/delivery";
import { clientAddress, spendRequest } from "@/lib/server/rate-limit";

/**
 * Carrier lookups are the one public endpoint that spends someone else's quota:
 * every miss is a Nova Poshta API call. The query is attacker-controlled, so the
 * `s-maxage` below only helps for repeats — a changed letter is a fresh key.
 *
 * The budget is generous on purpose: this backs an as-you-type field in
 * checkout, so a real buyer filling in a city and a branch must never hit it.
 */
const budget = { limit: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  // Cheapest rejection first, before the budget or any parsing.
  //
  // `Origin` is NOT the header to read here: browsers omit it on a same-origin
  // GET, so checking it the way the POST routes do would have broken the city
  // field outright. Measured in Chromium and WebKit: both send
  // `Sec-Fetch-Site: same-origin` and no `Origin` at all.
  //
  // Absent means an older client, so this fails open — it is defence in depth,
  // not authentication. Page scripts cannot forge a `Sec-Fetch-*` header; a
  // non-browser client can, exactly as it can forge `Origin` elsewhere.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin")
    return Response.json(
      { code: "INVALID_REQUEST" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const retryAfter = spendRequest(`delivery:${clientAddress(request)}`, budget);
  if (retryAfter !== null)
    return Response.json(
      { code: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  const p = new URL(request.url).searchParams;
  const kind = p.get("kind");
  const query = p.get("q")?.trim() ?? "";
  const cityRef = p.get("city") ?? undefined;
  if (
    (kind !== "cities" && kind !== "branches" && kind !== "streets") ||
    query.length > 100 ||
    ((kind === "cities" || kind === "streets") && query.length < 2) ||
    ((kind === "branches" || kind === "streets") && !isDeliveryRef(cityRef))
  )
    return Response.json({ code: "INVALID_QUERY" }, { status: 400 });
  try {
    return Response.json(
      { options: await deliveryOptions(kind, query, cityRef) },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch {
    return Response.json(
      { code: "DELIVERY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
