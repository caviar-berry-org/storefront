"use client";

import { useRef, useState } from "react";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { CatalogGroup } from "./catalog-group";
import { CatalogText } from "./catalog-text";
import { CatalogImageField } from "./catalog-image-field";
import styles from "./catalog.module.css";
import { locales } from "@/i18n/routing";
import type { CaviarData } from "@/domain/managed-catalog";
import { StaffLanguage } from "../staff-language";

export function CaviarGalleryFields({
  data,
  error,
}: {
  data?: CaviarData;
  error: (field: string) => string | undefined;
}) {
  const product = data?.copy.ua;
  const [gallery, setGallery] = useState(
    (product?.gallery ?? []).map((item, key) => ({ key, src: item.src })),
  );
  const counter = useRef(gallery.length);
  return (
    <CatalogGroup
      title="Галерея подачі"
      collapsible
      help={copy.caviarImageHelp}
    >
      <input type="hidden" name="galleryCount" value={gallery.length} />
      {gallery.map(({ key, src }, index) => (
        <fieldset key={key} className={styles.item}>
          <legend>
            {copy.image} {index + 1}
          </legend>
          <CatalogImageField
            name={`gallery.${index}.image`}
            label={copy.image}
            initial={src}
            error={error(`gallery.${index}.image`)}
          />
          <div className={styles.pair}>
            {locales.map((locale) => (
              <CatalogText
                key={locale}
                name={`gallery.${index}.alt.${locale}`}
                label={
                  <>
                    {copy.alt} · <StaffLanguage locale={locale} />
                  </>
                }
                value={data?.copy[locale].gallery[key]?.alt}
                required
                limit={180}
                error={error(`gallery.${index}.alt.${locale}`)}
              />
            ))}
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={() =>
              setGallery((rows) => rows.filter((row) => row.key !== key))
            }
          >
            {copy.remove}
          </button>
        </fieldset>
      ))}
      <div>
        <button
          type="button"
          className={styles.button}
          disabled={gallery.length >= 10}
          onClick={() => {
            const key = counter.current++;
            setGallery((rows) => [...rows, { key, src: "" }]);
          }}
        >
          Додати фото
        </button>
      </div>
    </CatalogGroup>
  );
}
