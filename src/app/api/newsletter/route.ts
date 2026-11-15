import { recordPromotionCustomer } from "@/lib/server/promotion-customer";
import { mailbox } from "@/lib/server/mail/smtp";
import {
  issuePromotion,
  PromotionDeliveryError,
} from "@/lib/server/promotions/issue";
import { defaultLocale, isLocale } from "@/i18n/routing";
import {
  formError,
  formGuard,
  formTranslator,
  readFormRequest,
} from "@/lib/server/form-request";

export const runtime = "nodejs";
export const maxDuration = 30;

/** One address asks for a code once; the per-email throttle handles retries. */
const budget = { limit: 10, windowMs: 600_000 };

export async function POST(request: Request) {
  const t = formTranslator(request);
  const refused = formGuard(request, t, "newsletter", budget);
  if (refused) return refused;
  const input = await readFormRequest(request);
  if ("status" in input)
    return formError(t, input.status, "INVALID_REQUEST", input.message);

  const email = mailbox(input.data.email);
  if (!email) return formError(t, 422, "INVALID_EMAIL", "checkout.text14");

  if (input.data.website !== undefined && input.data.website !== "")
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");

  const requestedLocale =
    request.headers.get("X-Storefront-Locale") ?? undefined;
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
  try {
    const result = await issuePromotion(email, locale);
    await recordPromotionCustomer(email);
    return Response.json(
      { sent: true, alreadySent: result.alreadySent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PromotionDeliveryError && error.limited) {
      const response = formError(
        t,
        429,
        "RATE_LIMITED",
        "newsletter.rateLimited",
      );
      response.headers.set("Retry-After", "60");
      return response;
    }
  }

  return formError(
    t,
    503,
    "NEWSLETTER_UNAVAILABLE",
    "newsletter.requestFailed",
  );
}
