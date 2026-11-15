import "server-only";
import { unstable_cache } from "next/cache";
import {
  defaultPromotionSettings,
  readPromotionSettings,
} from "../../../domain/promotion-settings.ts";
import { promotionBook } from "./storage";

export const promotionSettingsTag = `promotion-settings:${process.env.APP_ENV ?? "unknown"}`;
export function promotionSettingsRef() {
  return promotionBook().collection("settings").doc("general");
}

const cachedSettings = unstable_cache(
  async () => {
    const doc = await promotionSettingsRef().get();
    return readPromotionSettings(doc.data());
  },
  [promotionSettingsTag, process.env.APP_ENV ?? "unknown"],
  { revalidate: 60, tags: [promotionSettingsTag] },
);

export async function storefrontPromotionSettings() {
  if (!["development", "production"].includes(process.env.APP_ENV ?? ""))
    return { ...defaultPromotionSettings, enabled: false };
  // Offline design fixtures keep the offer visible; submission still fails closed.
  if (
    process.env.APP_ENV === "development" &&
    process.env.CATALOG_SOURCE !== "firestore"
  )
    return defaultPromotionSettings;
  if (process.env.PROMOTION_EMAIL_ENABLED !== "true")
    return { ...defaultPromotionSettings, enabled: false };
  try {
    return await cachedSettings();
  } catch {
    return { ...defaultPromotionSettings, enabled: false };
  }
}
