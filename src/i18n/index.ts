import uk from "./uk.json" with { type: "json" };
import en from "./en.json" with { type: "json" };
import { defaultLocale, type Locale } from "./routing.ts";

export type MessageKey = keyof typeof uk;
const dictionaries: Record<Locale, Record<MessageKey, string>> = { ua: uk, en };

export type Translator = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

export function getTranslator(locale: Locale): Translator {
  return (key, values = {}) =>
    dictionaries[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
      values[name] === undefined ? match : String(values[name]),
    );
}

export const t = getTranslator(defaultLocale);
