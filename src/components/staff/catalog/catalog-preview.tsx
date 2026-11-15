"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { documentLanguage, locales, type Locale } from "@/i18n/routing";
import { CatalogGroup } from "./catalog-group";
import { StaffLanguage } from "../staff-language";
import styles from "./catalog.module.css";
import previewStyles from "./catalog-preview.module.css";

export function CatalogPreview({
  renderCard,
}: {
  renderCard: (read: (key: string) => string, locale: Locale) => ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<{
    form: FormData;
    locale: Locale;
  }>();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSnapshot((previous) =>
          previous
            ? { form: new FormData(form), locale: previous.locale }
            : previous,
        ),
      );
    };
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("click", refresh);
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => !root.current?.contains(change.target)))
        refresh();
    });
    observer.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["value", "checked"],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      form.removeEventListener("input", refresh);
      form.removeEventListener("change", refresh);
      form.removeEventListener("click", refresh);
    };
  }, []);
  return (
    <div ref={root}>
      <CatalogGroup collapsible title={copy.preview}>
        <div className={styles.controls}>
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              className={styles.button}
              aria-pressed={snapshot?.locale === locale}
              onClick={({ currentTarget: { form } }) => {
                if (form) setSnapshot({ form: new FormData(form), locale });
              }}
            >
              <StaffLanguage locale={locale} />
            </button>
          ))}
        </div>
        {snapshot ? (
          <div
            className={previewStyles.frame}
            lang={documentLanguage(snapshot.locale)}
          >
            {renderCard(
              (key) => String(snapshot.form.get(key) ?? "").trim(),
              snapshot.locale,
            )}
          </div>
        ) : (
          <p className={styles.muted}>{copy.previewHint}</p>
        )}
      </CatalogGroup>
    </div>
  );
}
