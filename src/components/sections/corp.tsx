import { contacts } from "@/content/contacts";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import type { CSSProperties } from "react";
import { EditorialPhoto } from "@/components/ui/editorial-photo";
import { Action } from "@/components/store/action";

export function CorpSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div
        className={`b-split relative min-h-[calc(100svh_-_var(--hdr-h-c,_62px))] p-[calc(var(--sec-gap)_/_2)_16px] items-stretch max-[640px]:min-h-0 max-[640px]:pt-[20px] max-[640px]:pb-[20px] b-grid ${ui.bGrid} b-split-rev`}
      >
        <div
          className={`bs-media b-img [grid-column:7/13] relative overflow-hidden min-h-[560px] max-[640px]:min-h-0 max-[640px]:aspect-[4/3] max-[560px]:aspect-[4/5] fx`}
        >
          <div className="px" data-px="">
            <EditorialPhoto
              name="corp-gift"
              alt={t("corp.alt1")}
              className="ph-b ph-img"
            />
          </div>
        </div>{" "}
        <div
          className={`bs-text [grid-column:1/6] flex flex-col justify-center gap-[28px] p-[80px_0] max-[640px]:p-[56px_0_24px]`}
        >
          <SplitText as="h2" className={`b-h2 ${ui.bH2} b-h2-left`}>
            {t("corp.heading1")}
            <span className="l2">{t("corp.text1")}</span>
          </SplitText>
          <p className={`b-p ${ui.bP} b-rv`}>{t("corp.paragraph1")}</p>{" "}
          <div className="b-rv">
            <p
              className={`b-label ${ui.bLabel}`}
              style={{ color: "var(--b-mute)" } as CSSProperties}
            >
              {t("corp.paragraph2")}
            </p>
            <ul className="occ-b">
              <li>{t("corp.text2")}</li>
              <li>{t("corp.text3")}</li>
              <li>{t("corp.text4")}</li>
            </ul>
          </div>{" "}
          <div className="corp-btns">
            <Action className={`b-btn ${ui.bBtn}`} action="gift" value="corp">
              {t("corp.text5")}
            </Action>
            <a
              className={`b-link ${ui.bLink}`}
              href={`tel:${contacts.phones[0].tel}`}
            >
              {t("contacts.link1")}
              <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                <path
                  d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                  fill="none"
                  stroke="currentColor"
                ></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
