import { permanentRedirect, notFound } from "next/navigation";
import { isLocale } from "@/i18n/routing";
export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}/offer#privacy`);
}
