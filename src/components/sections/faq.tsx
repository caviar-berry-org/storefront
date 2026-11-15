import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { Photo } from "@/components/ui/photo";
import { Accordion } from "@/components/ui/accordion";

export function FaqSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div
        className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec} b-grid ${ui.bGrid} faqb items-start`}
      >
        <div
          className={`faqb-media b-img framed-export [grid-column:2/6] sticky top-[72px] aspect-[1] overflow-hidden`}
        >
          <div className="px" data-px="">
            <figure className="ph-b ph-img">
              <Photo
                src="/assets/img/faq-spoon.webp"
                alt={t("faq.alt1")}
                loading="lazy"
              />
            </figure>
          </div>
        </div>{" "}
        <div
          className={`faqb-body [grid-column:7/13] grid gap-[36px] min-[641px]:[grid-column:5/13]`}
        >
          <SplitText as="h2" className={`b-h2 ${ui.bH2} b-h2-left b-h2-air`}>
            {t("faq.heading1")}
            <span className="l2">{t("faq.text1")}</span>
          </SplitText>
          <div>
            <Accordion title={<>{t("faq.text2")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph1")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text3")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph2")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text4")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph3")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text5")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph4")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text6")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph5")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text7")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph6")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text8")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph7")}</p>
              </div>
            </Accordion>
            <Accordion title={<>{t("faq.text9")}</>}>
              <div>
                <p className={`b-p ${ui.bP}`}>{t("faq.paragraph8")}</p>
              </div>
            </Accordion>
          </div>
        </div>
      </div>
    </>
  );
}
