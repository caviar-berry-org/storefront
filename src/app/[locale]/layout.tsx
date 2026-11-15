import { getTranslator } from "@/i18n";
import {
  defaultLocale,
  documentLanguage,
  isLocale,
  locales,
} from "@/i18n/routing";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StoreProvider } from "@/components/store/store-provider";
import { StoreOverlays } from "@/components/store/store-overlays";
import { Header } from "@/components/store/header";
import { FloatingContact } from "@/components/store/floating-contact";
import { NewsletterPrompt } from "@/components/store/newsletter-prompt";
import { Motion } from "@/components/store/motion";
import { SessionSplash } from "@/components/ui/session-splash";
import { LocaleScroll } from "@/components/store/locale-scroll";
import { VisitAttribution } from "@/components/store/visit-attribution";
import { site } from "@/lib/metadata";
import { PromotionOfferProvider } from "@/components/store/promotion-offer";
import { storefrontPromotionSettings } from "@/lib/server/promotions/settings";
import {
  managedCatalogEnabled,
  storefrontCaviar,
  storefrontGifts,
} from "@/lib/server/catalog/storefront";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getTranslator(locale);
  return {
    metadataBase: site.url,
    title: {
      default: t("layout.default1"),
      template: "%s | Ukrainian Caviar Berry",
    },
    description: t("layout.description1"),
    robots: { index: site.production, follow: site.production },
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  };
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F2F2F2",
};
export default async function RootLayout({
  children,
  modal,
  params,
}: {
  children: ReactNode;
  modal: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: segment } = await params;
  const locale = isLocale(segment) ? segment : defaultLocale;
  const t = getTranslator(locale);
  const [products, gifts, offer] = await Promise.all([
    storefrontCaviar(locale),
    storefrontGifts(locale),
    storefrontPromotionSettings(),
  ]);
  return (
    <html lang={documentLanguage(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- This App Router root layout shares the approved stylesheet across storefront pages. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=EB+Garamond:wght@400;500&family=Unbounded:wght@400&family=Marck+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionSplash locale={locale} />
        <LocaleScroll locale={locale} label={t("language.switching")} />
        <VisitAttribution />
        <StoreProvider
          products={products}
          gifts={gifts}
          preserveUnknown={managedCatalogEnabled()}
        >
          <PromotionOfferProvider value={offer}>
            <a className="skip-link" href="#main-content">
              {t("layout.link1")}
            </a>
            <Header />
            {children}
            {modal}
            <StoreOverlays />
            <FloatingContact />
            <NewsletterPrompt />
            <Motion outsideStorefront />
          </PromotionOfferProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
