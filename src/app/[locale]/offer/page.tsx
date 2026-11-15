import { getLegalContent } from "@/content/legal";
import { LegalPage } from "@/components/ui/legal-page";
import { isLocale } from "@/i18n/routing";
import { pageMetadata } from "@/lib/metadata";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/offer">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const content = await getLegalContent(locale, "offer");
  return {
    ...pageMetadata(locale, content.title, content.description, "/offer"),
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/offer">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <LegalPage
      locale={locale}
      content={await getLegalContent(locale, "offer")}
    />
  );
}
