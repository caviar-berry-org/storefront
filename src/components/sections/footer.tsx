import { contacts } from "@/content/contacts";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import Link from "next/link";
import { getTranslator } from "@/i18n";
import { localizedPath, type Locale } from "@/i18n/routing";
import { BrandEmblem } from "@/components/ui/brand-emblem";
import { Photo } from "@/components/ui/photo";
import { NewsletterForm } from "@/components/store/newsletter-form";
import { StorefrontLink } from "@/components/store/storefront-link";

export function FooterSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <>
      <div className="fb" data-tone="dark">
        <div className="fb-bg">
          <div className="px" data-px="">
            <figure className="ph-b ph-img">
              <Photo
                src="/assets/img/footer-bassano.jpg"
                alt={t("footer.alt1")}
                loading="lazy"
              />
            </figure>
          </div>
          <div className="fb-shade"></div>
        </div>{" "}
        <div
          className={`fb-in relative z-[2] flex flex-col gap-[36px] min-h-[100svh] pt-[96px] pb-[18px] max-[640px]:gap-5 max-[640px]:pt-16 b-wrap ${ui.bWrap}`}
        >
          <p className="fb-emblem">
            <BrandEmblem />
          </p>
          <div className={`b-grid ${ui.bGrid}`}>
            <div className={`fb-head [grid-column:1/8]`}>
              <SplitText as="h2" className={`b-h2 ${ui.bH2} fb-h`}>
                {t("page.text1")}
              </SplitText>
              <p className="slogan2 fb-slogan2">{t("footer.paragraph1")}</p>
            </div>{" "}
            <NewsletterForm />
          </div>{" "}
          <div className={`b-grid ${ui.bGrid} fb-bottom`}>
            <div className={`fb-about b-p ${ui.bP}`}>
              <p>
                <a
                  className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                  href={`tel:${contacts.phones[0].tel}`}
                >
                  {contacts.phones[0].display}
                </a>
                {" · "}
                <a
                  className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                  href={`tel:${contacts.phones[1].tel}`}
                >
                  {contacts.phones[1].display}
                </a>
                <br />
                <a
                  className="inline-flex min-h-6 items-center pointer-coarse:min-h-11"
                  href={`mailto:${contacts.email}`}
                >
                  {contacts.email}
                </a>
              </p>
              <p className="fb-addr">{t("footer.paragraph2")}</p>
            </div>{" "}
            <nav
              className={`fb-col grid [align-content:start] [grid-column:10/13] b-p ${ui.bP}`}
              aria-label={t("footer.ariaLabel1")}
            >
              <StorefrontLink section="delivery">
                {t("footer.link1")}
              </StorefrontLink>
              <Link href={localizedPath(locale, "/offer")}>
                {t("legal.privacy")}
              </Link>
              <a
                href={contacts.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("footer.instagram")}
              </a>
              <a
                href={contacts.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("footer.facebook")}
              </a>
            </nav>
          </div>{" "}
          <div
            className={`fb-legal flex justify-between flex-wrap gap-[16px] [color:rgba(242,_242,_242,_0.55)] [font-family:var(--b-sans)] text-[11px] tracking-[0.04em]`}
          >
            <span>{t("footer.text1")}</span>
          </div>
        </div>
      </div>
    </>
  );
}
