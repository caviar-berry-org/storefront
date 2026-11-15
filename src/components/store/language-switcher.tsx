"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslator } from "@/i18n/client";
import { documentLanguage, localizedPath, locales } from "@/i18n/routing";
import { rememberLocalePosition } from "./locale-scroll";

export function LanguageSwitcher({
  className = "",
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslator();
  const path = usePathname();
  const router = useRouter();
  const suffix = path.slice(localizedPath(locale).length);

  return (
    <div role="group" aria-label={t("language.label")} className={className}>
      {locales.map((language) => {
        const href = localizedPath(language, suffix);
        return (
          <Link
            key={language}
            href={href}
            hrefLang={documentLanguage(language)}
            aria-current={language === locale ? "page" : undefined}
            className="inline-flex min-h-11 min-w-8 items-center justify-center text-sm opacity-60 no-underline aria-[current=page]:opacity-100 hover:opacity-100"
            onNavigate={(event) => {
              event.preventDefault();
              if (language === locale) {
                onNavigate?.();
                return;
              }
              const catalogue = document.querySelector("#pmodal[open]")
                ? localizedPath(language)
                : undefined;
              const stored = rememberLocalePosition(
                href,
                Boolean(onNavigate),
                catalogue,
              );
              onNavigate?.();
              if (catalogue) {
                const destination = `${catalogue}${location.search}#ikra`;
                // Start the translated catalogue with a fresh interception cache.
                if (stored) location.replace(destination);
                else router.replace(destination, { scroll: false });
              } else if (suffix.startsWith("/products/")) {
                // A direct product visit must bypass previously intercepted routes.
                location.assign(href + location.search);
              } else {
                router.push(href + location.search, { scroll: false });
              }
            }}
          >
            {language.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
