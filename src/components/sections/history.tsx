import { AmbientVideo } from "@/components/store/ambient-video";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { HistoryText } from "@/components/ui/expandable";

export function HistorySection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
        <SplitText as="h2" className={`b-h2 ${ui.bH2}`}>
          {t("history.heading1")}
        </SplitText>{" "}
        <div
          className={`b-grid ${ui.bGrid} hist2 mt-[clamp(40px,_5vw,_72px)] items-start`}
        >
          <div
            className={`hist2-media [grid-column:1/5] sticky top-[80px] aspect-[4/5] overflow-hidden max-[640px]:relative max-[640px]:top-0 max-[640px]:aspect-[4/3] b-img`}
          >
            <div className="px" data-px="">
              <figure className="ph-b ph-img">
                <AmbientVideo
                  src="/assets/video/farm-aerial.mp4"
                  poster="/assets/img/history-video-poster.webp"
                />
              </figure>
            </div>
          </div>{" "}
          <HistoryText>
            <p>{t("history.paragraph1")}</p>
            <p>{t("history.paragraph2")}</p>
            <p>{t("history.paragraph3")}</p>
            <h3>{t("history.heading2")}</h3>
            <p>{t("history.paragraph4")}</p>
            <p>{t("history.paragraph5")}</p>
          </HistoryText>
        </div>{" "}
        <p className="b-quote b-rv">{t("history.paragraph6")}</p>
      </div>
    </>
  );
}
