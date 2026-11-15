import { getTranslator } from "@/i18n";
import { type Locale } from "@/i18n/routing";
import { BrandStamp } from "./brand-stamp";
import { SplashBootstrap } from "./splash-bootstrap";

export function SessionSplash({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <style id="session-splash-style">
        {"#session-splash{display:none}:root{}"}
      </style>
      <SplashBootstrap />
      <div id="session-splash" className="session-splash" role="status">
        <BrandStamp loading />
        <span className="sr">{t("loading.text1")}</span>
      </div>
    </>
  );
}
