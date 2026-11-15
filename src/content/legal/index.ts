import type { Locale } from "@/i18n/routing";

type LegalDocument = "offer";

interface LegalContent {
  title: string;
  description: string;
  sections: { id?: string; title: string; paragraphs: string[] }[];
}

const documents = {
  ua: {
    offer: () => import("./ua/offer.json"),
  },
  en: {
    offer: () => import("./en/offer.json"),
  },
} satisfies Record<
  Locale,
  Record<LegalDocument, () => Promise<{ default: LegalContent }>>
>;

export async function getLegalContent(locale: Locale, document: LegalDocument) {
  return (await documents[locale][document]()).default;
}
