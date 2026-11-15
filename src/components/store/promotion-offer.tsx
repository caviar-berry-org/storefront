"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  defaultPromotionSettings,
  type PromotionSettings,
} from "@/domain/promotion-settings";

const PromotionOffer = createContext<PromotionSettings>(
  defaultPromotionSettings,
);
export const usePromotionOffer = () => useContext(PromotionOffer);

export function PromotionOfferProvider({
  value,
  children,
}: {
  value: PromotionSettings;
  children: ReactNode;
}) {
  return (
    <PromotionOffer.Provider value={value}>{children}</PromotionOffer.Provider>
  );
}
