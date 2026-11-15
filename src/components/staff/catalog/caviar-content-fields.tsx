import type { CaviarData } from "@/domain/managed-catalog";
import { locales } from "@/i18n/routing";
import { StaffLanguage } from "../staff-language";
import { CatalogGroup } from "./catalog-group";
import { CatalogText } from "./catalog-text";
import styles from "./catalog.module.css";

const fields = [
  ["name", "Назва", 110, true],
  ["description", "Опис у каталозі", 520, true],
  ["intro", "Вступ у деталях", 520, false],
  ["tasteAccent", "Смак · виділений початок", 100, true],
  ["taste", "Смак · продовження", 750, false],
  ["fishLabel", "Підпис видів риб", 100, false],
  ["fish", "Походження або вид риби", 380, false],
  ["grain", "Зерно", 250, true],
  ["ingredients", "Склад", 750, true],
  ["storage", "Умови зберігання", 750, true],
  ["allergen", "Алергени", 300, true],
  ["pairing", "З чим смакує", 750, true],
  ["servingAlt", "Alt фото картки каталогу", 180, true],
  ["detailServingAlt", "Alt фото подачі в галереї", 180, false],
  ["latinNote", "Примітка зі зірочкою", 380, false],
] as const;
const nutrition = [
  ["calories", "Калорійність · ккал"],
  ["protein", "Білки · г"],
  ["fat", "Жири · г"],
  ["carbs", "Вуглеводи · г"],
  ["saturatedFat", "Насичені жири · г"],
  ["kj", "Енергетична цінність · кДж"],
] as const;
export function CaviarContentFields({
  data,
  error,
}: {
  data?: CaviarData;
  error: (field: string) => string | undefined;
}) {
  return (
    <>
      <CatalogGroup
        title="Опис і склад UA / EN"
        collapsible
        help="Виділений початок смаку має коричневий акцент. Продовження після коми показується звичайним текстом. Блок доставки й оплати спільний для всіх карток."
      >
        {fields.map(([key, label, limit, required]) => (
          <div key={key} className={styles.pair}>
            {locales.map((locale) => {
              const original = data?.copy[locale];
              const value =
                key === "taste"
                  ? original?.taste.slice(original.tasteAccent?.length ?? 0)
                  : key === "detailServingAlt"
                    ? (original?.detailServingAlt ??
                      (original?.detailServingImage ? original.servingAlt : ""))
                    : original?.[key];
              const name = `${key}.${locale}`;
              return (
                <CatalogText
                  key={locale}
                  name={name}
                  label={
                    <>
                      {label} · <StaffLanguage locale={locale} />
                    </>
                  }
                  value={value ?? ""}
                  required={required}
                  limit={limit}
                  area={limit > 250}
                  error={error(name)}
                />
              );
            })}
          </div>
        ))}
      </CatalogGroup>
      <CatalogGroup
        title="Поживна цінність"
        collapsible
        help="Введіть лише числа. Якщо компонент відсутній, вкажіть 0."
      >
        <div className={styles.pair}>
          {nutrition.map(([key, label], index) => (
            <CatalogText
              key={key}
              name={`nutrition.${key}`}
              label={label}
              value={data?.nutrition[key]}
              required={index < 4}
              limit={12}
              inputMode="decimal"
              pattern="[0-9]{1,5}([.,][0-9]{1,3})?"
              error={error(`nutrition.${key}`)}
            />
          ))}
        </div>
      </CatalogGroup>
    </>
  );
}
