import "server-only";
import uaMail from "../../../content/mail/ua.json" with { type: "json" };
import type { InquiryKind } from "../../../domain/inquiry.ts";
import type { NotifyFields } from "./telegram.ts";

/**
 * The chat ticket is built from the record the staff email uses, with the same
 * labels, so the two cannot drift apart.
 */
// Identifiers belong in the admin; number and subject are already the heading.
const technical = new Set([
  "id",
  "targetId",
  "variantId",
  "locale",
  "number",
  "subject",
]);

export function ownerTicket(fields: Record<string, string>): NotifyFields {
  const labels = uaMail["owner.fields"];
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) => value && !technical.has(key))
      .map(([key, value]) => [
        labels[key as keyof typeof labels] ?? key,
        value,
      ]),
  );
}

/** Only the kinds that are announced: a restock request writes to nobody. */
export function inquiryTypeLabel(
  kind: Exclude<InquiryKind, "notify">,
  targetId?: string,
) {
  const types = uaMail["owner.types"];
  if (kind === "gift")
    return targetId === "corp" ? types.corporate : types.gift;
  return types.write;
}
