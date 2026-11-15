"use client";
import { useTranslator } from "@/i18n/client";
import { BrandStamp } from "@/components/ui/brand-stamp";
export default function Loading() {
  const t = useTranslator();
  return (
    <div className="grid min-h-svh place-content-center" role="status">
      <BrandStamp loading />
      <span className="sr">{t("loading.text1")}</span>
    </div>
  );
}
