"use client";

import { useRef, useState } from "react";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { CatalogGroup } from "./catalog-group";
import { CatalogText } from "./catalog-text";
import { CatalogImageField } from "./catalog-image-field";
import styles from "./catalog.module.css";
import { packLimit, type CatalogRecord } from "@/domain/managed-catalog";
import type { Variant } from "@/domain/catalog";

const blankPack: Variant = {
  id: "",
  weightGrams: 0,
  priceMinor: 0,
  available: true,
  image: "",
  imageIsRepresentative: false,
};

export function CaviarPackFields({
  record,
  selectedPack,
  error,
}: {
  record?: CatalogRecord<"caviar">;
  selectedPack?: string;
  error: (field: string) => string | undefined;
}) {
  const product = record?.data.copy.ua;
  const initialPacks = product?.variants ?? [blankPack];
  const [packs, setPacks] = useState(
    initialPacks.map((pack, key) => ({ pack, key })),
  );
  const counter = useRef(packs.length);
  return (
    <CatalogGroup
      title="Фасування"
      collapsible
      initiallyOpen={Boolean(
        selectedPack && initialPacks.some(({ id }) => id === selectedPack),
      )}
      help="Від 1 до 6 різних ваг. Для кожної потрібні ціна та фото: воно показується першим слайдом і змінюється разом із вибраною вагою. Демонстраційні кадри додавайте у галерею. Фактичну кількість і партії ведемо у вкладці «Залишки»."
    >
      <input type="hidden" name="packCount" value={packs.length} />
      {error("packCount") && (
        <p role="alert" className={styles.error}>
          {error("packCount")}
        </p>
      )}
      {packs.map(({ pack, key }, index) => (
        <fieldset
          key={key}
          className={styles.item}
          data-selected={selectedPack === pack.id || undefined}
        >
          <legend>
            {pack.weightGrams
              ? `${pack.weightGrams} г`
              : `Фасування ${index + 1}`}
          </legend>
          <input type="hidden" name={`pack.${index}.id`} value={pack.id} />
          <div className={styles.pair}>
            <CatalogText
              name={`pack.${index}.weight`}
              label="Вага · г"
              value={pack.weightGrams || ""}
              required
              limit={6}
              pattern="[1-9][0-9]*"
              inputMode="numeric"
              error={error(`pack.${index}.weight`)}
            />
            <CatalogText
              name={`pack.${index}.price`}
              label="Ціна · грн"
              value={pack.priceMinor ? pack.priceMinor / 100 : ""}
              required
              limit={10}
              pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
              inputMode="decimal"
              error={error(`pack.${index}.price`)}
            />
          </div>
          <CatalogImageField
            name={`pack.${index}.image`}
            label="Фото фасування"
            initial={pack.image}
            error={error(`pack.${index}.image`)}
          />
          <div className={styles.controls}>
            <label>
              <input
                type="checkbox"
                name={`pack.${index}.representative`}
                defaultChecked={pack.imageIsRepresentative}
              />{" "}
              Фото репрезентативне
            </label>
          </div>
          <div className={styles.controls}>
            {packs.length > 1 && (
              <button
                className={styles.button}
                type="button"
                onClick={() =>
                  setPacks((rows) => rows.filter((row) => row.key !== key))
                }
              >
                {copy.remove}
              </button>
            )}
          </div>
        </fieldset>
      ))}
      <div>
        <button
          type="button"
          className={styles.button}
          disabled={packs.length >= packLimit}
          onClick={() => {
            const key = counter.current++;
            setPacks((rows) => [...rows, { key, pack: blankPack }]);
          }}
        >
          {copy.addItem}
        </button>
      </div>
    </CatalogGroup>
  );
}
