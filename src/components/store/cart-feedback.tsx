"use client";

import { useLocale, useTranslator } from "@/i18n/client";
import { MAX_CART_SUBTOTAL_MINOR } from "@/domain/cart";
import { formatMoney } from "@/lib/format-money";
import type { CartChangeError } from "./store-provider";
import { StorefrontLink } from "./storefront-link";

export function CartFeedback({
  error,
  onClose,
}: {
  error: CartChangeError;
  onClose?: () => void;
}) {
  const t = useTranslator();
  const locale = useLocale();
  if (error.kind === "subtotal")
    return (
      <>
        {t("cart.subtotalLimit", {
          limit: formatMoney(MAX_CART_SUBTOTAL_MINOR, locale),
        })}{" "}
        <StorefrontLink
          className="underline underline-offset-4"
          section="contacts"
          beforeNavigate={onClose}
        >
          {t("inquiry.goToContacts")}
        </StorefrontLink>
      </>
    );
  if (error.kind === "stock")
    return error.limit
      ? t("cart.quantityLimit", { value1: error.limit })
      : t("cart.paragraph3");
  return t("cart.checkUnavailable");
}
