import { getTranslator } from "@/i18n";
import { type Locale } from "@/i18n/routing";
import { BrandStamp } from "./brand-stamp";
import { SplashBootstrap } from "./splash-bootstrap";

/**
 * Belongs in <head>: a <style> in <body> is only valid as the first child of its
 * parent, and the bootstrap reaches for this sheet by id, not by position. Head
 * also guarantees the hiding rule is applied before the splash node is parsed.
 */
export function SessionSplashStyle() {
  return (
    <style id="session-splash-style">
      {"#session-splash{display:none}:root{}"}
    </style>
  );
}

export function SessionSplash({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <SplashBootstrap />
      <div id="session-splash" className="session-splash" role="status">
        <BrandStamp loading />
        <span className="sr">{t("loading.text1")}</span>
      </div>
    </>
  );
}
