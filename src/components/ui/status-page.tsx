"use client";
import { ui } from "@/components/ui/styles";
import { useLocale, useTranslator } from "@/i18n/client";
import { localizedPath } from "@/i18n/routing";
import Link from "next/link";
import { useEffect, useState } from "react";
import { lastStorefrontPageKey } from "./page-visit";

export function StatusPage({
  code,
  retry,
}: {
  code: "404" | "500";
  retry?: () => void;
}) {
  const t = useTranslator();
  const home = localizedPath(useLocale());
  const title = t(code === "404" ? "notFound.title1" : "globalError.heading1");
  const description = t(
    code === "404" ? "notFound.description1" : "globalError.paragraph1",
  );
  const [remaining, setRemaining] = useState(12);
  const [paused, setPaused] = useState(false);
  const finished = remaining === 0;

  useEffect(() => {
    if (paused || finished) return;
    const timer = window.setInterval(
      () => setRemaining((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [paused, finished]);

  useEffect(() => {
    if (!finished || paused) return;
    let destination = home;
    try {
      const stored = sessionStorage.getItem(lastStorefrontPageKey);
      if (
        stored &&
        /^\/(?:ua|en)(?:\/(?:products\/[a-z0-9-]+|privacy|terms|offer))?$/.test(
          stored,
        ) &&
        (stored === home || stored.startsWith(home + "/")) &&
        stored !== location.pathname
      ) {
        // A previously successful page may have stopped working.
        sessionStorage.removeItem(lastStorefrontPageKey);
        destination = stored;
      }
    } catch {
      /* Home is always a safe fallback. */
    }
    if (destination !== location.pathname) location.replace(destination);
  }, [finished, home, paused]);

  return (
    <main id="main-content" className="status-page">
      <span className={`b-label ${ui.bLabel}`}>{t("brand.name")}</span>
      <p className="status-code" aria-hidden="true">
        {code}
      </p>
      <h1 className={`b-h2 ${ui.bH2}`}>{title}</h1>
      <p className={`b-p ${ui.bP}`}>{description}</p>
      <div className="status-actions">
        {retry && (
          <button type="button" className={`b-btn ${ui.bBtn}`} onClick={retry}>
            {t("common.retry")}
          </button>
        )}
        <Link className={`b-link ${ui.bLink}`} href={home}>
          {t("common.home")}
        </Link>
      </div>
      <div className="return-countdown">
        <p>
          {finished
            ? t("statusPage.finished")
            : paused
              ? t("statusPage.text1")
              : t("statusPage.text2", { value1: remaining })}
        </p>
        {!finished && (
          <button
            type="button"
            className={`b-link ${ui.bLink}`}
            onClick={() => setPaused(!paused)}
          >
            {paused ? t("statusPage.text3") : t("statusPage.text4")}
          </button>
        )}
      </div>
    </main>
  );
}
