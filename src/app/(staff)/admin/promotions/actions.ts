"use server";
import { revalidatePath, updateTag } from "next/cache";
import { catalogStaff } from "@/lib/server/catalog/access";
import {
  promotionSettingsRef,
  promotionSettingsTag,
} from "@/lib/server/promotions/settings";
import { promotionDatabase } from "@/lib/server/promotions/storage";
import {
  readPromotionSettings,
  type PromotionSettings,
} from "@/domain/promotion-settings";
import { freshCaviar } from "@/lib/server/catalog/storefront";
export async function savePromotionSettings(input: PromotionSettings) {
  const staff = await catalogStaff();
  if (!staff) return { error: "unavailable" } as const;
  if (
    typeof input?.enabled !== "boolean" ||
    !Number.isSafeInteger(input.percent) ||
    input.percent < 1 ||
    input.percent > 99 ||
    !Number.isSafeInteger(input.revision) ||
    (input.productIds !== undefined &&
      (!Array.isArray(input.productIds) ||
        !input.productIds.length ||
        input.productIds.length > 100 ||
        input.productIds.some(
          (id) => typeof id !== "string" || !/^[a-z0-9-]{1,100}$/.test(id),
        )))
  )
    return { error: "invalid" } as const;
  try {
    const products = await freshCaviar();
    if (
      input.productIds?.some(
        (id) => !products.some((product) => product.id === id),
      )
    )
      return { error: "invalid" } as const;
    const db = promotionDatabase();
    const ref = promotionSettingsRef();
    const result = await db.runTransaction(async (tx) => {
      const previous = readPromotionSettings((await tx.get(ref)).data());
      if (previous.revision !== input.revision)
        return { error: "conflict" } as const;
      const settings = {
        enabled: input.enabled,
        percent: input.percent,
        revision: previous.revision + 1,
        ...(input.productIds && { productIds: [...new Set(input.productIds)] }),
      };
      tx.set(ref, settings);
      tx.create(ref.collection("activity").doc(), {
        at: Date.now(),
        actor: staff.uid,
        before: previous,
        after: settings,
      });
      return { settings };
    });
    if (!("error" in result)) {
      updateTag(promotionSettingsTag);
      revalidatePath("/admin/promotions");
    }
    return result;
  } catch {
    return { error: "unavailable" } as const;
  }
}

export async function queryPromotionIssues(cursor: {
  before?: string;
  id?: string;
  search?: string;
}) {
  if (!(await (await import("@/lib/server/staff-session")).getStaffSession()))
    return { error: "unavailable" } as const;
  if (
    typeof cursor?.search !== "string" ||
    cursor.search.length > 254 ||
    (cursor.search.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cursor.search.trim()))
  )
    return { error: "searchInvalid" } as const;
  try {
    return await (
      await import("@/lib/server/promotions/queries")
    ).readPromotionIssues(cursor);
  } catch {
    return { error: "unavailable" } as const;
  }
}
