import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { Photo } from "@/components/ui/photo";
import { Accordion } from "@/components/ui/accordion";
import { Action } from "@/components/store/action";
import { StorefrontLink } from "@/components/store/storefront-link";

export function BlogSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
        <SplitText as="h2" className={`b-h2 ${ui.bH2} b-center b-h2-mid`}>
          {t("blog.heading1")}
          <span className="l2">{t("blog.text1")}</span>
        </SplitText>
        <p
          className={`b-p ${ui.bP} b-lead-c max-w-[520px] [margin:24px_0_0] text-left b-lead-full b-lead-mid b-rv`}
        >
          {t("blog.paragraph1")}
          <br className="max-[640px]:hidden" /> {t("blog.paragraph1Continued")}
        </p>{" "}
        <div
          className={`blogb grid grid-cols-[repeat(3,_minmax(0,_1fr))] gap-[16px] max-[760px]:grid-cols-[1fr]`}
        >
          <Action
            className={`blogb-item flex flex-col gap-[14px] items-start text-left p-0 [border:0] [background:none] [color:inherit] [font:inherit] cursor-pointer b-rv`}
            action="post"
            value="0"
            href={`/${locale}/journal/serving-caviar`}
          >
            <span className="tile tile-photo framed-export">
              <div className="px" data-px="">
                <figure className="ph-b ph-img">
                  <Photo
                    src="/assets/img/editorial/journal/caviar-serving-card.webp"
                    alt={t("blog.alt1")}
                    loading="lazy"
                  />
                </figure>
              </div>
            </span>
            <span className={`tc-name ${ui.tcName}`}>{t("blog.text2")}</span>
            <span className={`b-link ${ui.bLink}`}>
              {t("blog.text3")}
              <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                <path
                  d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                  fill="none"
                  stroke="currentColor"
                ></path>
              </svg>
            </span>
          </Action>
          <Action
            className={`blogb-item flex flex-col gap-[14px] items-start text-left p-0 [border:0] [background:none] [color:inherit] [font:inherit] cursor-pointer b-rv`}
            action="post"
            value="1"
            href={`/${locale}/journal/packing-and-delivery`}
          >
            <span className="tile tile-photo">
              <div className="px" data-px="">
                <figure className="ph-b ph-img">
                  <Photo
                    src="/assets/img/editorial/journal/blog-jar.jpg"
                    alt={t("blog.alt2")}
                    loading="lazy"
                  />
                </figure>
              </div>
            </span>
            <span className={`tc-name ${ui.tcName}`}>{t("blog.text4")}</span>
            <span className={`b-link ${ui.bLink}`}>
              {t("blog.text3")}
              <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                <path
                  d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                  fill="none"
                  stroke="currentColor"
                ></path>
              </svg>
            </span>
          </Action>
          <Action
            className={`blogb-item flex flex-col gap-[14px] items-start text-left p-0 [border:0] [background:none] [color:inherit] [font:inherit] cursor-pointer b-rv`}
            action="post"
            value="2"
            href={`/${locale}/journal/sturgeon-species`}
          >
            <span className="tile tile-photo framed-export">
              <div className="px" data-px="">
                <figure className="ph-b ph-img">
                  <Photo
                    src="/assets/img/editorial/journal/sturgeon-species.webp"
                    alt={t("blog.alt3")}
                    loading="lazy"
                  />
                </figure>
              </div>
            </span>
            <span className={`tc-name ${ui.tcName}`}>{t("blog.text6")}</span>
            <span className={`b-link ${ui.bLink}`}>
              {t("blog.text3")}
              <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                <path
                  d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                  fill="none"
                  stroke="currentColor"
                ></path>
              </svg>
            </span>
          </Action>
        </div>{" "}
        <div className="arch-b">
          <p className={`b-label ${ui.bLabel}`}>{t("blog.paragraph2")}</p>
          <Accordion
            title={
              <>
                <span className="arch-t">
                  <span className="yr">{"2020"}</span>
                  <span className={`tc-name ${ui.tcName}`}>
                    {t("blog.text7")}
                  </span>
                </span>
              </>
            }
          >
            <div>
              <div className="arch-body">
                <div className="arch-media arch-media--video">
                  <video
                    aria-label={t("blog.text8")}
                    controls
                    playsInline
                    preload="none"
                    poster="/assets/img/editorial/journal/archive-2020-poster.webp"
                  >
                    <source
                      src="/assets/video/archive-2020.mp4"
                      type="video/mp4"
                    />
                    {t("blog.videoUnsupported")}
                  </video>
                </div>
                <div className="arch-txt">
                  <div className={`b-p ${ui.bP} art-txt`}>
                    <p>{t("blog.paragraph3")}</p>
                  </div>
                  <StorefrontLink
                    className={`b-link ${ui.bLink}`}
                    section="about"
                  >
                    {t("blog.link1")}
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
            </div>
          </Accordion>
          <Accordion
            title={
              <>
                <span className="arch-t">
                  <span className="yr">{"2016"}</span>
                  <span className={`tc-name ${ui.tcName}`}>
                    {t("blog.text9")}
                  </span>
                </span>
              </>
            }
          >
            <div>
              <div className="arch-body">
                <div className="arch-media arch-media--wide">
                  <figure className="ph-b ph-img">
                    <Photo
                      src="/assets/img/editorial/journal/archive-2016-sturgeon.webp"
                      alt={t("blog.archive2016Alt")}
                      loading="lazy"
                      sizes="(max-width: 760px) 100vw, 45vw"
                    />
                  </figure>
                </div>
                <div className="arch-txt">
                  <div className={`b-p ${ui.bP} art-txt`}>
                    <p>{t("blog.paragraph4")}</p>
                  </div>
                  <StorefrontLink
                    className={`b-link ${ui.bLink}`}
                    section="history"
                  >
                    {t("blog.link2")}
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
            </div>
          </Accordion>
        </div>
      </div>
    </>
  );
}
