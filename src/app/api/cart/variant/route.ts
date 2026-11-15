import { quantityLimit } from "@/domain/cart";
import { validCatalogId } from "@/domain/managed-catalog";
import { cachedCaviarProduct } from "@/lib/server/catalog/storefront";
import {
  formError,
  formTranslator,
  readFormRequest,
} from "@/lib/server/form-request";

export async function POST(request: Request) {
  const t = formTranslator(request);
  const input = await readFormRequest(request);
  if ("status" in input)
    return formError(t, input.status, "INVALID_REQUEST", input.message);

  // Same origin rule as the neighbouring public routes. The values here are
  // public, but the route must not become an uncapped way to spend our quota.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return formError(t, 403, "INVALID_REQUEST", "forms.invalidRequest");

  const { productId, variantId } = input.data;
  if (!validCatalogId(productId) || !validCatalogId(variantId))
    return formError(t, 422, "INVALID_CART", "checkout.invalidCart");

  try {
    const product = await cachedCaviarProduct(productId);
    const variant = product?.variants.find(({ id }) => id === variantId);
    return Response.json(
      {
        limit: variant ? quantityLimit(variant) : 0,
        priceMinor: variant?.priceMinor ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return formError(t, 503, "CART_CHECK_UNAVAILABLE", "cart.checkUnavailable");
  }
}
