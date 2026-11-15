"use client";

import { useRef, useState } from "react";
import {
  giftItemLimit,
  giftItemNameLimit,
  type GiftItem,
} from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { locales } from "@/i18n/routing";
import { CatalogGroup } from "./catalog-group";
import { CatalogText } from "./catalog-text";
import { StaffIcon } from "../staff-icon";
import { StaffLanguage } from "../staff-language";
import styles from "./catalog.module.css";

const blank: GiftItem = { ua: "", en: "", variantIds: [] };

export function GiftComposition({
  initialItems,
  choices,
  error,
}: {
  initialItems?: GiftItem[];
  choices: { id: string; label: string }[];
  error: (field: string) => string | undefined;
}) {
  const initial = initialItems ?? [blank];
  const counter = useRef(initial.length);
  const [items, setItems] = useState(() =>
    initial.map((item, index) => ({ ...item, key: index })),
  );
  function remove(key: number) {
    setItems((current) => current.filter((item) => item.key !== key));
  }
  function add() {
    const key = counter.current++;
    setItems((current) => [...current, { ...blank, key }]);
  }
  function update(key: number, change: Partial<GiftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  return (
    <CatalogGroup collapsible title={copy.items} help={copy.packLinksHelp}>
      <input type="hidden" name="itemCount" value={items.length} />
      {items.map((item, index) => {
        const legacy = item.variantIds.length > 1;
        const selected = item.variantIds[0] ?? "";
        const selectedLabel =
          choices.find(({ id }) => id === selected)?.label ?? selected;
        return (
          <fieldset key={item.key} className={styles.item}>
            <legend>
              {copy.row} {index + 1}
            </legend>
            <div className={styles.pair}>
              {locales.map((locale) => (
                <CatalogText
                  key={locale}
                  name={`items.${index}.${locale}`}
                  label={<StaffLanguage locale={locale} />}
                  value={item[locale]}
                  required
                  limit={Math.max(
                    giftItemNameLimit,
                    initial[item.key]?.[locale].length ?? 0,
                  )}
                  error={error(`items.${index}.${locale}`)}
                />
              ))}
            </div>
            <details className={styles.packPicker}>
              <summary className={styles.packSummary}>
                <StaffIcon name="chevron" />
                <span>
                  {copy.packLinks}
                  {legacy
                    ? ` · ${item.variantIds.length}`
                    : selected && ` · ${selectedLabel}`}
                </span>
              </summary>
              {legacy && (
                <p className={styles.muted}>
                  {copy.legacyPackLinks}{" "}
                  {item.variantIds
                    .map(
                      (id) =>
                        choices.find((choice) => choice.id === id)?.label ?? id,
                    )
                    .join(", ")}
                  .
                </p>
              )}
              {item.variantIds.map((id) => (
                <input
                  key={id}
                  type="hidden"
                  name={`items.${index}.variantIds`}
                  value={id}
                />
              ))}
              <div className={styles.packChoices}>
                {[{ id: "", label: copy.noPackLink }, ...choices].map(
                  ({ id, label }) => (
                    <label key={id} className={styles.packChoice}>
                      <input
                        type="radio"
                        name={`packChoice.${item.key}`}
                        value={id}
                        checked={!legacy && selected === id}
                        onChange={() =>
                          update(item.key, { variantIds: id ? [id] : [] })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ),
                )}
              </div>
            </details>
            {items.length > 1 && (
              <button
                className={styles.button}
                type="button"
                onClick={() => remove(item.key)}
              >
                {copy.remove}
              </button>
            )}
          </fieldset>
        );
      })}
      <div>
        <button
          type="button"
          className={styles.button}
          disabled={items.length >= giftItemLimit}
          onClick={add}
        >
          {copy.addItem}
        </button>
      </div>
    </CatalogGroup>
  );
}
