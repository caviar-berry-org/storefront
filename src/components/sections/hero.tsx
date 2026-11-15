import { StorefrontLink } from "@/components/store/storefront-link";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { EditorialPhoto } from "@/components/ui/editorial-photo";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";

/** Supplied vertical banner; it has no original to rebuild a ladder from. */
const MOBILE_BANNER = {
  media: "(max-width: 640px)",
  sizes: "100vw",
  sources: { "image/webp": "/assets/img/hero-mobile.webp 1170w" },
};

export function HeroSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className="hb" data-tone="dark">
        {" "}
        <div className="hb-media">
          <EditorialPhoto
            name="hero"
            alt=""
            imageClassName="hb-roe"
            priority
            extraSources={[MOBILE_BANNER]}
          />
          <div className="hb-veil"></div>
        </div>{" "}
        <div
          className={`hb-bottom absolute left-[16px] right-[16px] bottom-[clamp(56px,_12vh,_130px)] z-[2] flex justify-between items-end gap-[24px] max-[760px]:flex-col max-[760px]:items-start`}
        >
          <div
            className={`hb-text max-w-[min(860px,_100%)] grid gap-[14px] [justify-items:start]`}
          >
            <SplitText
              as="h1"
              className={`hb-h1 [font-family:var(--b-cond)] font-normal uppercase text-[clamp(40px,_4.6vw,_84px)] leading-[1.04] [text-wrap:balance] tracking-[0.03em]`}
            >
              {t("page.text1")}
            </SplitText>
            <SplitText as="p" className="slogan2 hb-sub">
              <span className="max-[640px]:block">{`${t("hero.slogan1")} `}</span>
              <span className="max-[640px]:block">{t("hero.slogan2")}</span>
            </SplitText>
            <StorefrontLink className={`b-link ${ui.bLink}`} section="ikra">
              {t("about.link1")}
              <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                <path
                  d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                  fill="none"
                  stroke="currentColor"
                ></path>
              </svg>
            </StorefrontLink>
          </div>{" "}
          <StorefrontLink className={`b-link ${ui.bLink}`} section="about">
            {t("hero.link1")}
            <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
              <path
                d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                fill="none"
                stroke="currentColor"
              ></path>
            </svg>
          </StorefrontLink>
        </div>{" "}
      </div>
    </>
  );
}
