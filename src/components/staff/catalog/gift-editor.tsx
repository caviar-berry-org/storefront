"use client";

import { GiftComposition } from "./gift-composition";
import { GiftCard } from "@/components/store/gift-card";
import { CatalogPreview } from "./catalog-preview";
import { saveCatalogAction } from "@/app/(staff)/admin/products/actions";
import {
  giftView,
  isGiftPriceBoundary,
  parseMinor,
  type CatalogRecord,
} from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { CatalogEditorForm } from "./catalog-editor-form";
import { CatalogGroup } from "./catalog-group";
import { CatalogImageField } from "./catalog-image-field";
import { CatalogText } from "./catalog-text";
import { locales } from "@/i18n/routing";
import { StaffIcon } from "../staff-icon";
import { StaffLanguage } from "../staff-language";
import styles from "./catalog.module.css";

export function GiftEditor({
  record,
  back,
  choices,
}: {
  back: string;
  record?: CatalogRecord<"gift-sets">;
  choices: { id: string; label: string }[];
}) {
  const gift = record?.data;
  return (
    <CatalogEditorForm
      back={back}
      // Visibility changes move the card on and off the public storefront.
      confirm={(form) => {
        const publishing = form.get("published") === "on";
        if (publishing === Boolean(record?.published)) return null;
        return publishing
          ? {
              title: copy.publishConfirmTitle,
              body: copy.publishConfirmBody,
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
          "gift-sets",
          record?.id ?? null,
          record?.revision ?? 0,
          form,
        )
      }
    >
      {(error) => (
        <>
          <CatalogGroup collapsible title={copy.image} help={copy.mediaHelp}>
            <CatalogImageField
              name="image"
              kind="gift-sets"
              label={copy.image}
              initial={gift?.image}
              error={error("image")}
            />
            <div className={styles.pair}>
              {locales.map((locale) => (
                <CatalogText
                  key={locale}
                  name={`alt.${locale}`}
                  label={
                    <>
                      {copy.alt} · <StaffLanguage locale={locale} />
                    </>
                  }
                  value={gift?.alt[locale]}
                  required
                  limit={180}
                  error={error(`alt.${locale}`)}
                />
              ))}
            </div>
          </CatalogGroup>
          <CatalogGroup collapsible title={copy.price}>
            <div className={styles.amount}>
              <label className={styles.field}>
                <span>{copy.price}</span>
                <span className={styles.priceBoundary}>
                  <select
                    name="boundary"
                    defaultValue={gift?.boundary ?? "upTo"}
                  >
                    <option value="upTo">{copy.upTo}</option>
                    <option value="from">{copy.from}</option>
                    <option value="fixed">{copy.fixedPrice}</option>
                  </select>
                  <StaffIcon name="chevron" />
                </span>
              </label>
              <CatalogText
                name="price"
                label={copy.currency}
                value={gift && gift.priceMinor / 100}
                required
                limit={10}
                pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
                inputMode="decimal"
                error={error("price")}
              />
            </div>
          </CatalogGroup>
          <CatalogGroup collapsible title={copy.name}>
            <div className={styles.pair}>
              {locales.map((locale) => (
                <CatalogText
                  key={locale}
                  name={`name.${locale}`}
                  label={
                    <>
                      {copy.name} · <StaffLanguage locale={locale} />
                    </>
                  }
                  value={gift?.name[locale]}
                  required
                  limit={90}
                  error={error(`name.${locale}`)}
                />
              ))}
            </div>
          </CatalogGroup>
          <GiftComposition
            initialItems={gift?.items}
            choices={choices}
            error={error}
          />
          <CatalogPreview
            renderCard={(read, locale) => {
              const translate = (key: string) => ({
                ua: read(`${key}.ua`),
                en: read(`${key}.en`),
              });
              const price = parseMinor(read("price"));
              const boundary = read("boundary");
              const view = giftView(
                "preview",
                {
                  name: translate("name"),
                  alt: translate("alt"),
                  image: read("image"),
                  boundary: isGiftPriceBoundary(boundary) ? boundary : "upTo",
                  priceMinor: price ?? 0,
                  items: Array.from(
                    { length: Number(read("itemCount")) },
                    (_, index) => ({
                      ...translate(`items.${index}`),
                      variantIds: [],
                    }),
                  ),
                },
                locale,
              );
              return (
                <GiftCard
                  preview
                  locale={locale}
                  gift={{
                    ...view,
                    price: price === null ? "" : view.price,
                    items: view.items.filter(Boolean),
                  }}
                />
              );
            }}
          />

          <CatalogGroup collapsible title={copy.publication}>
            <label>
              <input
                name="published"
                type="checkbox"
                defaultChecked={record?.published ?? false}
              />{" "}
              {copy.visibility}
            </label>
          </CatalogGroup>
        </>
      )}
    </CatalogEditorForm>
  );
}
