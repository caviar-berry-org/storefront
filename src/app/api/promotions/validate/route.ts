import {
  formError,
  formTranslator,
  readFormRequest,
} from "@/lib/server/form-request";
import { normalizePromotionCode } from "@/domain/promotion";
import { validatePromotion } from "@/lib/server/promotions/validate";

export async function POST(request: Request) {
  const t = formTranslator(request);
  const input = await readFormRequest(request);
  if ("status" in input)
    return formError(t, input.status, "INVALID_REQUEST", input.message);

  if (request.headers.get("origin") !== new URL(request.url).origin)
    return formError(t, 403, "INVALID_REQUEST", "forms.invalidRequest");
  const code = normalizePromotionCode(input.data.code);
  if (!code) return formError(t, 422, "INVALID_PROMO", "cart.invalidPromo");

  const result = await validatePromotion(code);
  if (result.status === "unavailable")
    return formError(t, 503, "PROMOTIONS_UNAVAILABLE", "cart.text1");
  if (result.status === "held") {
    // Not something retyping can fix: the hold clears on its own, so the buyer
    // is told to wait rather than told the code was never valid.
    // Capped: a hold with no deadline reports an open-ended wait, and the
    // header has to stay a number a client can act on.
    const minutes = Math.min(
      60,
      Math.max(1, Math.ceil((result.heldUntil - Date.now()) / 60000)),
    );
    const response = formError(t, 409, "PROMO_HELD", "cart.promoHeld");
    response.headers.set("Retry-After", String(minutes * 60));
    return response;
  }
  if (result.status === "invalid")
    return formError(t, 422, "INVALID_PROMO", "cart.promoRejected");

  return Response.json(result.promotion, {
    headers: { "Cache-Control": "no-store" },
  });
}
