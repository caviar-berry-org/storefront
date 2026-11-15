"use client";
import { useId } from "react";
import { useTranslator } from "@/i18n/client";
export function BrandStamp({ loading = false }: { loading?: boolean }) {
  const t = useTranslator();
  const id = useId();
  return (
    <div
      className={`stamp${loading ? " stamp-loading" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120">
        <defs>
          <path
            id={id}
            d="M60 60 m-48 0 a48 48 0 1 1 96 0 a48 48 0 1 1 -96 0"
          />
        </defs>
        <text>
          <textPath
            href={`#${id}`}
            textLength="296"
            lengthAdjust="spacingAndGlyphs"
          >
            {t("brand.stamp")}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
