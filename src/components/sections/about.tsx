import { StorefrontLink } from "@/components/store/storefront-link";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import type { CSSProperties } from "react";
import { Photo } from "@/components/ui/photo";
import { EditorialPhoto } from "@/components/ui/editorial-photo";
import { AboutItem } from "@/components/ui/expandable";

export function AboutSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div
        className={`b-split relative min-h-[calc(100svh_-_var(--hdr-h-c,_62px))] p-[calc(var(--sec-gap)_/_2)_16px] items-stretch max-[640px]:min-h-0 max-[640px]:pt-[20px] max-[640px]:pb-[20px] b-split-top b-grid ${ui.bGrid}`}
      >
        <div
          className={`bs-text [grid-column:1/6] flex flex-col justify-center gap-[28px] p-[80px_0] max-[640px]:p-[56px_0_24px]`}
        >
          <SplitText as="h2" className={`b-h2 ${ui.bH2}`}>
            {t("about.heading1")}
            <span className="l2">{t("about.text1")}</span>
          </SplitText>
          <div
            className={`bs-foot flex flex-col gap-[28px] max-[640px]:gap-[20px]`}
          >
            <p className={`b-label ${ui.bLabel}`}>{t("about.paragraph1")}</p>
            <p className={`b-p ${ui.bP} b-rv`}>{t("about.paragraph2")}</p>
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
          </div>
        </div>
        <div
          className={`bs-media b-img [grid-column:7/13] relative overflow-hidden min-h-[560px] max-[640px]:min-h-0 max-[640px]:aspect-[4/3] max-[560px]:aspect-[4/5]`}
        >
          <div className="px" data-px="">
            <EditorialPhoto
              name="about-taste"
              alt={t("about.alt1")}
              className="ph-b ph-img"
            />
          </div>
        </div>
      </div>{" "}
      <div
        className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec} b-grid ${ui.bGrid} water items-start`}
      >
        <div
          className={`water-txt [grid-column:1/5] sticky top-[80px] grid gap-[24px]`}
        >
          <SplitText as="h2" className={`b-h2 ${ui.bH2}`}>
            {t("about.heading2")}
          </SplitText>
          <p className={`water-copy b-p ${ui.bP} b-rv`}>
            {t("about.paragraph3")}
          </p>
        </div>{" "}
        <div className={`water-vars [grid-column:6/13] grid gap-[56px]`}>
          <div className={`wv-media grid gap-[16px]`}>
            <div
              className={`wv-item b-img framed-export relative aspect-[16/10] overflow-hidden [background:#1a1a1a]`}
            >
              <div className="px" data-px="">
                <figure className="ph-b ph-img">
                  <Photo
                    src="/assets/img/editorial/story/bere-farm1.webp"
                    alt={t("about.alt2")}
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
            <div
              className={`wv-item b-img framed-export relative aspect-[16/10] overflow-hidden [background:#1a1a1a]`}
            >
              <div className="px" data-px="">
                <figure className="ph-b ph-img">
                  <Photo
                    src="/assets/img/editorial/story/bere-img1696.webp"
                    alt={t("about.alt3")}
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
          </div>
        </div>
      </div>{" "}
      <div
        className={`b-wrap ${ui.bWrap} b-grid ${ui.bGrid} lsplit items-start about-ls`}
        style={
          {
            paddingTop: "calc(var(--sec-gap)/2)",
            paddingBottom: "calc(var(--sec-gap)/2)",
          } as CSSProperties
        }
      >
        <div
          className={`ls-media b-img framed-export [grid-column:2/6] sticky top-[72px] aspect-[1] overflow-hidden ls-bleed`}
        >
          <div className="px" data-px="">
            <figure className="ph-b ph-img">
              <Photo
                src="/assets/img/editorial/story/hand-spoon.webp"
                alt={t("about.alt4")}
                loading="lazy"
              />
            </figure>
          </div>
        </div>{" "}
        <div
          className={`ls-body [grid-column:7/13] grid [justify-items:start]`}
        >
          <AboutItem title={t("about.text2")}>
            <p className={`b-p ${ui.bP}`}>{t("about.paragraph4")}</p>
          </AboutItem>
          <AboutItem title={t("about.text3")}>
            <p className={`b-p ${ui.bP}`}>{t("about.paragraph5")}</p>
          </AboutItem>
          <AboutItem title={t("about.text4")}>
            <p className={`b-p ${ui.bP}`}>{t("about.paragraph6")}</p>
          </AboutItem>
          <AboutItem title={t("about.text5")}>
            <p className={`b-p ${ui.bP}`}>{t("about.paragraph7")}</p>
          </AboutItem>
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
        </div>
      </div>
    </>
  );
}
