import { contacts } from "@/content/contacts";
import { ui } from "@/components/ui/styles";
import { getTranslator } from "@/i18n";
import { documentLanguage, localizedPath, type Locale } from "@/i18n/routing";
import Link from "next/link";
import { PageVisit } from "./page-visit";
interface LegalContent {
  title: string;
  sections: { id?: string; title: string; paragraphs: string[] }[];
}
const heading = "mb-3 [font-family:var(--b-cond)] text-[27px]";

export function LegalPage({
  content,
  locale,
}: {
  content: LegalContent;
  locale: Locale;
}) {
  const label = getTranslator(locale);
  return (
    <main
      id="main-content"
      lang={documentLanguage(locale)}
      className="mx-auto max-w-[880px] px-6 pt-[calc(var(--hdr-h)_+_60px)] pb-20"
    >
      <PageVisit />
      <h1
        className={`b-h2 ${ui.bH2} mb-8 [overflow-wrap:anywhere] max-[480px]:text-[clamp(20px,7vw,32px)]`}
      >
        {content.title}
      </h1>
      {content.sections.map((section) => (
        <section
          id={section.id}
          style={{ scrollMarginTop: "calc(var(--hdr-h) + 24px)" }}
          className="mt-7 space-y-3"
          key={section.title}
        >
          {section.title && <h2 className={heading}>{section.title}</h2>}
          {section.paragraphs.map((paragraph) => (
            <p className={`b-p ${ui.bP}`} key={paragraph}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <section className="mt-7">
        <h2 className={heading}>{label("legal.contact")}</h2>
        <address className={`b-p ${ui.bP} flex flex-wrap gap-x-4 not-italic`}>
          <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
          <a href={`tel:${contacts.phones[0].tel}`}>
            {contacts.phones[0].display}
          </a>
        </address>
      </section>
      <Link className={`b-link ${ui.bLink} mt-8`} href={localizedPath(locale)}>
        {label("common.home")}
      </Link>
    </main>
  );
}
