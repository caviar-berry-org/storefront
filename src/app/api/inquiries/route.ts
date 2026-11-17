import { after } from "next/server";
import { notify } from "@/lib/server/notify/telegram";
import { cookies } from "next/headers";
import { attributionCookie, readAttribution } from "@/domain/attribution";
import { deliverMailJobs } from "@/lib/server/mail/jobs";
import {
  saveInquiry,
  InquiryConflict,
  InquiryLimit,
} from "@/lib/server/inquiry-submission";
import type { InquiryInput } from "@/domain/inquiry";
import {
  freshCaviar,
  managedCatalogEnabled,
  publishedGiftExists,
} from "@/lib/server/catalog/storefront";
import { validCatalogId } from "@/domain/managed-catalog";
import { isVariantAvailable } from "@/domain/catalog";
import { kyivDate, validateInquiry } from "@/domain/inquiry";
import {
  formError,
  formGuard,
  formTranslator,
  readFormRequest,
} from "@/lib/server/form-request";

/** A visitor may send a couple of forms; a script sends hundreds. */
const budget = { limit: 10, windowMs: 600_000 };

export async function POST(request: Request) {
  const t = formTranslator(request);
  const refused = formGuard(request, t, "inquiries", budget);
  if (refused) return refused;
  const input = await readFormRequest(request);
  if ("status" in input)
    return formError(t, input.status, "INVALID_REQUEST", input.message);

  if (input.data.website !== undefined && input.data.website !== "")
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const requestId = request.headers.get("Idempotency-Key");
  if (!requestId || !/^[a-z0-9-]{36}$/i.test(requestId))
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const { kind, subject } = input.data;
  if (
    (kind !== "gift" && kind !== "write" && kind !== "notify") ||
    typeof subject !== "string" ||
    !subject.trim() ||
    subject.length > 200
  )
    return formError(t, 422, "INVALID_INQUIRY", "forms.invalidRequest");

  const errors = validateInquiry(input.data, kind, kyivDate());
  if (Object.keys(errors).length)
    return formError(
      t,
      422,
      "INVALID_INQUIRY",
      "checkout.text1",
      Object.fromEntries(
        Object.entries(errors).map(([field, code]) => [
          field,
          t(`inquiry.error.${code}`),
        ]),
      ),
    );

  const { targetId, variantId } = input.data;
  try {
    if (
      kind === "gift" &&
      targetId !== "corp" &&
      (targetId !== undefined || managedCatalogEnabled())
    ) {
      if (!validCatalogId(targetId) || !(await publishedGiftExists(targetId)))
        return formError(
          t,
          409,
          "GIFT_UNAVAILABLE",
          "inquiry.selectionUnavailable",
        );
    }
    if (
      kind === "notify" &&
      (targetId !== undefined || managedCatalogEnabled())
    ) {
      const product = validCatalogId(targetId)
        ? (await freshCaviar()).find(({ id }) => id === targetId)
        : undefined;
      const variant = product?.variants.find(({ id }) => id === variantId);
      if (!product || (variantId !== undefined && !variant))
        return formError(
          t,
          409,
          "PRODUCT_UNAVAILABLE",
          "inquiry.selectionUnavailable",
        );
      if (
        variant
          ? isVariantAvailable(variant)
          : product.variants.some(isVariantAvailable)
      )
        return formError(
          t,
          409,
          "PRODUCT_AVAILABLE",
          "inquiry.restockAvailable",
        );
    }
    const fields = input.data as unknown as InquiryInput;
    await saveInquiry(
      {
        kind,
        locale:
          request.headers.get("X-Storefront-Locale") === "en" ? "en" : "ua",
        subject,
        name: fields.name,
        contact: fields.contact,
        comment: fields.comment ?? "",
        date: fields.date ?? "",
        consent: fields.consent,
        ...(typeof targetId === "string" && { targetId }),
        ...(typeof variantId === "string" && { variantId }),
      },
      requestId,
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
      readAttribution((await cookies()).get(attributionCookie)?.value) ??
        undefined,
    );
    after(async () => {
      await Promise.allSettled([
        deliverMailJobs(),
        // The subject and kind say what it is; the name and contact stay in
        // the admin, where they are protected.
        notify(
          "submission",
          subject,
          { Тип: kind },
          { throttleKey: requestId },
        ),
      ]);
    });
    return Response.json(
      { accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InquiryLimit)
      return formError(t, 429, "RATE_LIMITED", "newsletter.rateLimited");
    if (error instanceof InquiryConflict)
      return formError(t, 409, "REQUEST_CONFLICT", "forms.invalidRequest");
  }

  return formError(
    t,
    503,
    "INQUIRY_UNAVAILABLE",
    kind === "notify" ? "inquiry.notifyUnavailable" : "inquiry.unavailable",
  );
}

export const maxDuration = 60;
