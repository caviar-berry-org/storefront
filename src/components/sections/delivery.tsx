import { contacts } from "@/content/contacts";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { Accordion } from "@/components/ui/accordion";

export function DeliverySection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
        <SplitText
          as="h2"
          className={`b-h2 ${ui.bH2} b-center b-h2-mid b-h2-air`}
        >
          {t("delivery.heading1")}
          <span className="l2">{t("delivery.text1")}</span>
        </SplitText>{" "}
        <div
          className={`d-acc max-w-[760px] [margin:clamp(40px,_5vw,_64px)_auto_0] b-rv`}
        >
          <Accordion title={<>{t("delivery.text2")}</>}>
            <div>
              <div className={`b-p ${ui.bP}`}>
                <p>{t("delivery.paragraph1")}</p>
              </div>
            </div>
          </Accordion>
          <Accordion title={<>{t("delivery.text3")}</>}>
            <div>
              <div className={`b-p ${ui.bP}`}>
                <ul>
                  <li>{t("delivery.text4")}</li>
                  <li>{t("delivery.paymentWallets")}</li>
                  <li>{t("delivery.text5")}</li>
                </ul>
              </div>
            </div>
          </Accordion>
          <Accordion title={<>{t("delivery.text6")}</>}>
            <div>
              <div className={`b-p ${ui.bP}`}>
                <p>{t("delivery.paragraph2")}</p>
              </div>
            </div>
          </Accordion>
          <Accordion title={<>{t("delivery.text7")}</>}>
            <div>
              <div className={`b-p ${ui.bP}`}>
                <p>{t("delivery.paragraph3")}</p>
                <p>
                  {t("delivery.paragraph4")}
                  <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
                  {t("delivery.paragraph5")}
                  <a href={`tel:${contacts.phones[0].tel}`}>
                    {contacts.phones[0].display}
                  </a>
                  {"."}
                </p>
              </div>
            </div>
          </Accordion>
        </div>
      </div>
    </>
  );
}
