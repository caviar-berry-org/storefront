export type PromotionSettings = {
  enabled: boolean;
  percent: number;
  productIds?: string[];
  revision: number;
};

export const defaultPromotionSettings: PromotionSettings = {
  enabled: true,
  percent: 10,
  revision: 0,
};

export function readPromotionSettings(
  data: Record<string, unknown> | undefined,
): PromotionSettings {
  if (!data) return defaultPromotionSettings;
  if (
    typeof data.enabled !== "boolean" ||
    !Number.isSafeInteger(data.percent) ||
    Number(data.percent) < 1 ||
    Number(data.percent) > 99 ||
    !Number.isSafeInteger(data.revision)
  )
    throw new Error("Invalid promotion settings.");
  return {
    enabled: data.enabled,
    percent: Number(data.percent),
    revision: Number(data.revision),
    ...(Array.isArray(data.productIds) &&
      data.productIds.every(
        (id) => typeof id === "string" && /^[a-z0-9-]{1,100}$/.test(id),
      ) && { productIds: data.productIds as string[] }),
  };
}
