import { getTranslator } from "@/i18n";
import { isLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { HeroSection } from "@/components/sections/hero";
import { CatalogSection } from "@/components/sections/catalog";
import { GiftsSection } from "@/components/sections/gifts";
import { PartnersSection } from "@/components/sections/partners";
import { AboutSection } from "@/components/sections/about";
import { HistorySection } from "@/components/sections/history";
import { CorpSection } from "@/components/sections/corp";
import { QualitySection } from "@/components/sections/quality";
import { DeliverySection } from "@/components/sections/delivery";
import { FaqSection } from "@/components/sections/faq";
import { BlogSection } from "@/components/sections/blog";
import { ContactsSection } from "@/components/sections/contacts";
import { FooterSection } from "@/components/sections/footer";
import { Motion } from "@/components/store/motion";
import { PageVisit } from "@/components/ui/page-visit";
import { pageMetadata } from "@/lib/metadata";
import { homeGraph } from "@/lib/seo-graph";
import { JsonLd } from "@/components/seo/json-ld";
import { storefrontGifts } from "@/lib/server/catalog/storefront";
import type { ReactNode } from "react";
export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return pageMetadata(locale, t("page.text1"), t("page.text2"), "");
}
function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={className}
      data-block={id ?? "hero"}
      data-variant="b"
    >
      <div className="v-b">{children}</div>
    </section>
  );
}
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const gifts = await storefrontGifts(locale);
  return (
    <>
      <JsonLd items={homeGraph(locale, gifts)} />
      <PageVisit />
      <main id="main-content">
        <div id="top" />
        <Section className="hero pt-[var(--hdr-h)]">
          <HeroSection locale={locale} />
        </Section>
        <Section id="ikra">
          <CatalogSection locale={locale} />
        </Section>
        <Section id="gifts">
          <GiftsSection locale={locale} />
        </Section>
        <div className="partners" data-block="partners" data-variant="b">
          <div className="v-b">
            <PartnersSection locale={locale} />
          </div>
        </div>
        <Section id="about">
          <AboutSection locale={locale} />
        </Section>
        <Section id="history">
          <HistorySection locale={locale} />
        </Section>
        <Section id="corp">
          <CorpSection locale={locale} />
        </Section>
        <Section id="quality">
          <QualitySection locale={locale} />
        </Section>
        <Section id="delivery">
          <DeliverySection locale={locale} />
        </Section>
        <Section id="faq">
          <FaqSection locale={locale} />
        </Section>
        <Section id="blog">
          <BlogSection locale={locale} />
        </Section>
        <Section id="contacts">
          <ContactsSection locale={locale} />
        </Section>
      </main>
      <footer data-block="footer" data-variant="b">
        <div className="v-b">
          <FooterSection locale={locale} />
        </div>
      </footer>
      <Motion />
    </>
  );
}
