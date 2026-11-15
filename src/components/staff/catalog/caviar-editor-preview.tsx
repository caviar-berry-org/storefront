"use client";

import { ProductCard } from "@/components/store/product-card";
import type { Variant } from "@/domain/catalog";
import {
  parseMinor,
  sellableQuantity,
  type CatalogRecord,
} from "@/domain/managed-catalog";
import { kyivDate } from "@/domain/inquiry";
import { CatalogPreview } from "./catalog-preview";

export function CaviarEditorPreview({
  record,
}: {
  record?: CatalogRecord<"caviar">;
}) {
  const data = record?.data;
  const product = data?.copy.ua;
  return (
    <CatalogPreview
      renderCard={(read, locale) => {
        const id = record?.id ?? "preview";
        const animated = read("animated") === "on";
        const today = kyivDate();
        const variants = Array.from(
          { length: Number(read("packCount")) },
          (_, index): Variant => {
            const key = `pack.${index}`;
            const packId = read(`${key}.id`);
            const stock = data?.stock[packId];
            const weightGrams = Number(read(`${key}.weight`));
            const priceMinor = parseMinor(read(`${key}.price`));
            return {
              id: packId,
              weightGrams,
              priceMinor: priceMinor ?? 0,
              available:
                (product?.variants.find((pack) => pack.id === packId)
                  ?.available ??
                  true) &&
                weightGrams > 0 &&
                priceMinor !== null,
              stockQuantity: stock ? (sellableQuantity(stock, today) ?? 0) : 0,
              image: read(`${key}.image`),
              imageIsRepresentative: read(`${key}.representative`) === "on",
            };
          },
        );
        return (
          <ProductCard
            preview
            locale={locale}
            product={{
              id,
              slug: product?.slug ?? read("slug"),
              name: read(`name.${locale}`),
              description: read(`description.${locale}`),
              grain: read(`grain.${locale}`),
              latin: read("latin"),
              latinNote:
                read("premium") === "on"
                  ? read(`latinNote.${locale}`)
                  : undefined,
              season:
                read("seasonal") === "on" ? read(`season.${locale}`) : null,
              plate: product?.plate ?? "#e5dacf",
              lidImage: animated ? read("lidImage") : "",
              jarBodyImage: animated ? read("jarBodyImage") : "",
              jarImage: animated ? "" : read("jarImage"),
              servingImage: read("servingImage"),
              servingAlt: read(`servingAlt.${locale}`),
              variants,
            }}
          />
        );
      }}
    />
  );
}
