import { contacts } from "@/content/contacts";
import { StorefrontLink } from "@/components/store/storefront-link";
import { BrandStamp } from "@/components/ui/brand-stamp";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { Action } from "@/components/store/action";

export function ContactsSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
        <SplitText as="h2" className={`b-h2 ${ui.bH2} b-center b-h2-left`}>
          {t("contacts.heading1")}
          <span className="l2">{t("catalog.text1")}</span>
        </SplitText>{" "}
        <div
          className={`cpanel grid grid-cols-[minmax(0,_8fr)_minmax(0,_4fr)] mt-[clamp(40px,_5vw,_64px)] [border:1px_dotted_var(--b-dot)] max-[640px]:grid-cols-[1fr] b-rv`}
        >
          <div
            className={`cp-main grid gap-[28px] [align-content:start] p-[28px]`}
          >
            <p className={`b-p ${ui.bP}`}>{t("contacts.paragraph1")}</p>
            <div
              className={`cp-btns flex flex-wrap gap-[16px_28px] items-center`}
            >
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
              <Action
                className={`b-link ${ui.bLink}`}
                type="button"
                action="write"
                value=""
              >
                {t("contacts.text1")}
                <svg className="arr" viewBox="0 0 22 9" aria-hidden="true">
                  <path
                    d="M0 4.5h21M17 .8l4 3.7-4 3.7"
                    fill="none"
                    stroke="currentColor"
                  ></path>
                </svg>
              </Action>
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
          </div>{" "}
          <aside
            className={`cp-side grid gap-[24px] [align-content:start] [justify-items:start] p-[28px] [border-left:1px_dotted_var(--b-dot)] max-[640px]:[border-left:0] max-[640px]:[border-top:1px_dotted_var(--b-dot)]`}
          >
            <dl>
              <div>
                <dt className={`b-label ${ui.bLabel}`}>
                  {t("contacts.text2")}
                </dt>
                <dd>
                  <a
                    className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                    href={`tel:${contacts.phones[0].tel}`}
                  >
                    {contacts.phones[0].display}
                  </a>
                  <br />
                  <a
                    className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                    href={`tel:${contacts.phones[1].tel}`}
                  >
                    {contacts.phones[1].display}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={`b-label ${ui.bLabel}`}>
                  {t("contacts.text3")}
                </dt>
                <dd>
                  <a
                    className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                    href={`mailto:${contacts.email}`}
                  >
                    {contacts.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={`b-label ${ui.bLabel}`}>
                  {t("contacts.text4")}
                </dt>
                <dd>{t("contacts.text5")}</dd>
              </div>
            </dl>
            <BrandStamp />
          </aside>
        </div>{" "}
      </div>
    </>
  );
}
