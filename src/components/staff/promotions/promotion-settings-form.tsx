"use client";
import { useState, useTransition } from "react";
import { savePromotionSettings } from "@/app/(staff)/admin/promotions/actions";
import type { PromotionSettings } from "@/domain/promotion-settings";
import { promotionsCopy as copy } from "@/i18n/promotions-staff-uk";
import promotionStyles from "./promotions.module.css";
import styles from "../catalog/catalog.module.css";
export function PromotionSettingsForm({
  initial,
  products,
  editable,
}: {
  initial: PromotionSettings;
  products: { id: string; name: string }[];
  editable: boolean;
}) {
  const [settings, setSettings] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [all, setAll] = useState(!initial.productIds);
  const [error, setError] = useState<
    "invalid" | "conflict" | "unavailable" | null
  >(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className={`${styles.group} ${promotionStyles.form}`}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        start(async () => {
          try {
            const result = await savePromotionSettings({
              enabled: settings.enabled,
              percent: settings.percent,
              revision: settings.revision,
              ...(!all && { productIds: settings.productIds ?? [] }),
            });
            if ("error" in result) setError(result.error ?? "unavailable");
            else {
              setSettings(result.settings);
              setBaseline(result.settings);
              setSaved(true);
            }
          } catch {
            setError("unavailable");
          }
        });
      }}
    >
      <fieldset
        disabled={!editable || pending}
        className={promotionStyles.panel}
      >
        <label className={promotionStyles.choice}>
          <input
            className={promotionStyles.switch}
            role="switch"
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => {
              setSettings({ ...settings, enabled: event.target.checked });
              setSaved(false);
            }}
          />
          {copy.enabled}
        </label>
        <label className={promotionStyles.percent}>
          {copy.percent}
          <input
            className={promotionStyles.input}
            type="number"
            min={1}
            max={99}
            required
            value={settings.percent}
            onChange={(event) => {
              setSettings({ ...settings, percent: Number(event.target.value) });
              setSaved(false);
            }}
            aria-describedby={
              error === "invalid" ? "promotion-settings-error" : undefined
            }
          />
        </label>
        <fieldset
          className={promotionStyles.scope}
          aria-describedby={
            error === "invalid" ? "promotion-settings-error" : undefined
          }
        >
          <legend>{copy.scope}</legend>
          <label className={promotionStyles.choice}>
            <input
              type="radio"
              name="promotion-scope"
              checked={all}
              onChange={() => {
                setAll(true);
                setSaved(false);
              }}
            />
            {copy.all}
          </label>
          <label className={promotionStyles.choice}>
            <input
              type="radio"
              name="promotion-scope"
              checked={!all}
              onChange={() => {
                setAll(false);
                setSaved(false);
              }}
            />
            {copy.selected}
          </label>
          {!all &&
            products.map((product) => (
              <label key={product.id} className={promotionStyles.choice}>
                <input
                  type="checkbox"
                  checked={settings.productIds?.includes(product.id) ?? false}
                  onChange={(event) => {
                    setSettings({
                      ...settings,
                      productIds: event.target.checked
                        ? [...(settings.productIds ?? []), product.id]
                        : (settings.productIds?.filter(
                            (id) => id !== product.id,
                          ) ?? []),
                    });
                    setSaved(false);
                  }}
                />
                {product.name}
              </label>
            ))}
        </fieldset>
        {error && (
          <p
            id="promotion-settings-error"
            role="alert"
            className={promotionStyles.error}
          >
            {copy[error]}
          </p>
        )}
        <div className={styles.controls}>
          <button className={styles.primary} disabled={pending}>
            {copy.save}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setSettings(baseline);
              setAll(!baseline.productIds);
              setError(null);
              setSaved(false);
            }}
          >
            {copy.cancel}
          </button>
        </div>
      </fieldset>
      {!editable && <p>{copy.readOnly}</p>}
      {saved && <p role="status">{copy.saved}</p>}
    </form>
  );
}
