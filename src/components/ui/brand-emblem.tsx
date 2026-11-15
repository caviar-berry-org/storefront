"use client";
import Image from "next/image";
import { useTranslator } from "@/i18n/client";

export function BrandEmblem({
  className,
  eager = false,
}: {
  className?: string;
  eager?: boolean;
}) {
  const t = useTranslator();
  return (
    <Image
      src="/assets/img/logo-emblem.svg"
      alt={t("brand.name")}
      width={114}
      height={87}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
    />
  );
}
