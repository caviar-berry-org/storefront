"use client";

import { useState } from "react";
import { defaultJarBodyImage } from "@/lib/catalog-media";
import { saveCatalogAction } from "@/app/(staff)/admin/products/actions";
import { type CatalogRecord } from "@/domain/managed-catalog";
import { CaviarContentFields } from "./caviar-content-fields";
import { CaviarEditorPreview } from "./caviar-editor-preview";
import { CaviarGalleryFields } from "./caviar-gallery-fields";
import { CaviarPackFields } from "./caviar-pack-fields";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { locales } from "@/i18n/routing";
import { CatalogEditorForm } from "./catalog-editor-form";
import { CatalogGroup } from "./catalog-group";
import { CatalogImageField } from "./catalog-image-field";
import { CatalogText } from "./catalog-text";
import { StaffLanguage } from "../staff-language";
import styles from "./catalog.module.css";

export function CaviarEditor({
  record,
  back,
  selectedPack,
}: {
  back: string;
  record?: CatalogRecord<"caviar">;
  selectedPack?: string;
}) {
  const data = record?.data;
  const product = data?.copy.ua;
  const [cardImage, setCardImage] = useState(product?.servingImage ?? "");
  const [season, setSeason] = useState(Boolean(product?.season));
  const [animated, setAnimated] = useState(
    Boolean(product?.lidImage && !product.jarImage),
  );
  return (
    <CatalogEditorForm
      back={back}
      successHref={(id, form) =>
        !record && form.get("published") === "on"
          ? `${back}?created=${encodeURIComponent(id)}`
          : back
      }
      // Visibility changes move the card on and off the public storefront.
      confirm={(form) => {
        const publishing = form.get("published") === "on";
        if (publishing === Boolean(record?.published)) return null;
        return publishing
          ? {
              title: copy.publishConfirmTitle,
              body: `${copy.publishConfirmBody} ${copy.publishConfirmSitemap} ${copy.publishConfirmRestock}`,
              label: copy.publishConfirmSave,
            }
          : {
              title: copy.unpublishConfirmTitle,
              body: copy.unpublishConfirmBody,
              label: copy.unpublishConfirmSave,
            };
      }}
      save={(form) =>
        saveCatalogAction(
          "caviar",
          record?.id ?? null,
          record?.revision ?? 0,
          form,
        )
      }
    >
      {(error) => (
        <>
          <CatalogGroup
            title="Основне"
            help={copy.caviarBasicsHelp}
            collapsible
          >
            <div className={styles.pair}>
              {!record && (
                <CatalogText
                  name="slug"
                  label="Адреса товару"
                  limit={80}
                  required
                  pattern="[a-z0-9][a-z0-9\x2D]{0,79}"
                  error={error("slug")}
                />
              )}
              <CatalogText
                name="latin"
                label={copy.latinName}
                required
                limit={150}
                value={product?.latin ?? ""}
                error={error("latin")}
              />
            </div>
            <div className={styles.controls}>
              <label>
                <input
                  type="checkbox"
                  name="premium"
                  defaultChecked={data?.premium}
                />{" "}
                Преміум
              </label>
              <label>
                <input
                  type="checkbox"
                  name="seasonal"
                  checked={season}
                  onChange={(event) => setSeason(event.currentTarget.checked)}
                />{" "}
                Сезонний товар
              </label>
            </div>
            {season && (
              <div className={styles.pair}>
                {locales.map((locale) => (
                  <CatalogText
                    key={locale}
                    name={`season.${locale}`}
                    label={
                      <>
                        Період сезону · <StaffLanguage locale={locale} />
                      </>
                    }
                    required
                    limit={120}
                    value={data?.copy[locale].season ?? ""}
                    error={error(`season.${locale}`)}
                  />
                ))}
              </div>
            )}
          </CatalogGroup>
          <CatalogGroup
            title="Фото картки та галереї"
            collapsible
            help={`${copy.caviarImageHelp} Кришка та корпус утворюють анімовану банку ліворуч у каталозі. Корпус — квадратне зображення з прозорими кутами, чорним обідком і цілісним фото ікри; наклейка завантажується окремо. Фото картки показується праворуч у кадрі 4:5. Фото подачі — другий слайд галереї; без окремого фото використовується фото картки. Перший слайд змінюється при виборі ваги: його фото задається у «Фасуваннях». Для окремого фото подачі заповніть його alt обома мовами в розділі описів.`}
          >
            <label>
              <input
                type="checkbox"
                name="animated"
                checked={animated}
                onChange={(event) => setAnimated(event.currentTarget.checked)}
              />{" "}
              Анімована банка
            </label>
            <div className={styles.imageRows} hidden={!animated}>
              <CatalogImageField
                name="lidImage"
                active={animated}
                label="Фото кришки"
                initial={product?.lidImage}
                error={error("lidImage")}
              />
              <CatalogImageField
                name="jarBodyImage"
                active={animated}
                label="Фото корпусу з ікрою"
                initial={product?.jarBodyImage}
                fallbackSrc={
                  product ? defaultJarBodyImage(product.id) : undefined
                }
                fallbackLabel={copy.builtInBody}
                error={error("jarBodyImage")}
              />
            </div>
            <div hidden={animated}>
              <CatalogImageField
                name="jarImage"
                active={!animated}
                label="Фото закритої банки"
                initial={product?.jarImage ?? product?.variants[0]?.image}
                error={error("jarImage")}
              />
            </div>
            <CatalogImageField
              name="servingImage"
              label="Фото картки каталогу · права половина"
              initial={product?.servingImage}
              onImageChange={setCardImage}
              error={error("servingImage")}
            />
            <CatalogImageField
              name="detailServingImage"
              label="Фото подачі в галереї · другий слайд"
              initial={product?.detailServingImage}
              error={error("detailServingImage")}
              fallbackSrc={cardImage}
              fallbackLabel={copy.sharedServingImage}
              clearable
            />
          </CatalogGroup>
          <CaviarPackFields
            record={record}
            selectedPack={selectedPack}
            error={error}
          />
          <CaviarContentFields data={data} error={error} />
          <CaviarGalleryFields data={data} error={error} />
          <CatalogGroup
            title="SEO"
            collapsible
            help="Порожні поля заповнюються з назви, опису та першого фото фасування."
          >
            {locales.map((locale) => (
              <div key={locale} className={styles.pair}>
                <CatalogText
                  name={`seoTitle.${locale}`}
                  label={
                    <>
                      SEO-заголовок · <StaffLanguage locale={locale} />
                    </>
                  }
                  limit={110}
                  value={data?.copy[locale].seo?.title}
                  error={error(`seoTitle.${locale}`)}
                />
                <CatalogText
                  name={`seoDescription.${locale}`}
                  label={
                    <>
                      SEO-опис · <StaffLanguage locale={locale} />
                    </>
                  }
                  limit={260}
                  value={data?.copy[locale].seo?.description}
                  error={error(`seoDescription.${locale}`)}
                />
              </div>
            ))}
            <CatalogImageField
              name="seoImage"
              label="SEO-зображення"
              initial={product?.seo?.image}
              clearable
              error={error("seoImage")}
            />
          </CatalogGroup>
          <CaviarEditorPreview record={record} />
          <label>
            <input
              name="published"
              type="checkbox"
              defaultChecked={record?.published ?? false}
            />{" "}
            {copy.visibility}
          </label>
        </>
      )}
    </CatalogEditorForm>
  );
}
