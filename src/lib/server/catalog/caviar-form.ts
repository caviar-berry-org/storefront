import "server-only";

import type { Product } from "@/domain/catalog";
import {
  packLimit,
  validCatalogId,
  type CaviarData,
} from "@/domain/managed-catalog";
import type { Locale } from "@/i18n/routing";
import {
  CatalogFieldError,
  image,
  integer,
  localized,
  text,
} from "./form-fields";
import { caviarPacks } from "./caviar-packs";
import { nutritionInput, nutritionText } from "./nutrition";

const localizedFields = {
  name: [110, true],
  description: [520, true],
  intro: [520, false],
  tasteAccent: [100, true],
  taste: [750, false],
  fishLabel: [100, false],
  fish: [380, false],
  grain: [250, true],
  ingredients: [750, true],
  storage: [750, true],
  allergen: [300, true],
  pairing: [750, true],
  servingAlt: [180, true],
  detailServingAlt: [180, false],
  season: [120, true],
  latinNote: [380, false],
  seoTitle: [110, false],
  seoDescription: [260, false],
} as const;

export function caviarInput(
  form: FormData,
  id: string,
  previous?: CaviarData,
): CaviarData {
  const slug = previous?.copy.ua.slug ?? text(form, "slug", 80);
  if (!validCatalogId(slug)) throw new CatalogFieldError("slug");
  const nutrition = nutritionInput(form);
  const seasonal = form.get("seasonal") === "on";
  const premium = form.get("premium") === "on";
  const animated = form.get("animated") === "on";
  const lidImage = animated ? image(form, "lidImage") : "";
  const jarBodyImage = animated
    ? image(
        form,
        "jarBodyImage",
        !["premium", "hybrid", "sterlet", "trout"].includes(id),
      )
    : "";
  const jarImage = animated ? "" : image(form, "jarImage");
  const servingImage = image(form, "servingImage");
  const detailServingImage = image(form, "detailServingImage", false);
  const seoImage = image(form, "seoImage", false);
  const latin = text(form, "latin", 150);
  const count = integer(form, "packCount", 1, packLimit);
  const galleryCount = integer(form, "galleryCount", 0, 10);
  const { variants, stock } = caviarPacks(form, count, previous);

  const gallery = Array.from({ length: galleryCount }, (_, index) => {
    const key = `gallery.${index}`;
    return {
      src: image(form, `${key}.image`),
      alt: localized(form, `${key}.alt`, 180),
    };
  });

  function build(locale: Locale): Product {
    const fields = Object.fromEntries(
      Object.entries(localizedFields).map(([key, [limit, required]]) => [
        key,
        key === "season" && !seasonal
          ? ""
          : text(form, `${key}.${locale}`, limit, required),
      ]),
    ) as Record<keyof typeof localizedFields, string>;
    const {
      seoTitle,
      seoDescription,
      season,
      intro,
      fish,
      latinNote,
      fishLabel,
      tasteAccent,
      taste,
      ...copy
    } = fields;
    if (detailServingImage && !fields.detailServingAlt)
      throw new CatalogFieldError(`detailServingAlt.${locale}`);
    return {
      ...copy,
      id,
      slug,
      latin,
      intro: intro || null,
      fish: fish || null,
      season: season || null,
      englishName: text(form, "name.en", 110),
      nutrition: nutritionText(nutrition, locale),
      variants,
      taste:
        tasteAccent +
        (taste && !/^[,.;:!?]/.test(taste) ? ", " + taste : taste),
      tasteAccent,
      ...(latinNote && { latinNote }),
      ...(fishLabel && { fishLabel }),
      plate: previous?.copy[locale].plate ?? "#e5dacf",
      roeImage: previous?.copy[locale].roeImage ?? "",
      roeTile: previous?.copy[locale].roeTile ?? 0,
      lidImage,
      ...(jarImage && { jarImage }),
      ...(jarBodyImage && { jarBodyImage }),
      servingImage,
      ...(detailServingImage && { detailServingImage }),
      gallery: gallery.map(({ src, alt }) => ({ src, alt: alt[locale] })),
      seo: {
        title: seoTitle,
        description: seoDescription,
        ...(seoImage && { image: seoImage }),
      },
    };
  }

  return {
    copy: { ua: build("ua"), en: build("en") },
    nutrition,
    premium,
    stock,
  };
}
