import "server-only";
import { campaign, promotionBook } from "./storage";
import {
  promotionHeldUntil,
  promotionUsable,
  type Promotion,
} from "@/domain/promotion";
export async function validatePromotion(code: string) {
  if (!code.startsWith("UCB-")) return { status: "invalid" } as const;
  try {
    const doc = await promotionBook().collection("codes").doc(code).get();
    const data = doc.data();
    const now = Date.now();
    if (!data || data.campaign !== campaign)
      return { status: "invalid" } as const;
    // A code an unpaid order still holds is not a dead code, and saying so
    // costs a customer their trust: the buyer who closed the payment page is
    // told when it frees up instead of being told it was never valid.
    const heldUntil = promotionHeldUntil(data, now);
    if (heldUntil !== null) return { status: "held", heldUntil } as const;
    if (!promotionUsable(data, now)) return { status: "invalid" } as const;
    const promotion: Promotion = {
      code,
      percent: Number(data.percent),
      excludedProductIds: Array.isArray(data.excludedProductIds)
        ? data.excludedProductIds
        : ["trout"],
      ...(Array.isArray(data.productIds) && { productIds: data.productIds }),
    };
    return { status: "valid", promotion } as const;
  } catch {
    return { status: "unavailable" } as const;
  }
}
