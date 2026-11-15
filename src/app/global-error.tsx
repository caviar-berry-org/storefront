"use client";
import { StatusPage } from "@/components/ui/status-page";
import { useLocale } from "@/i18n/client";
import { documentLanguage } from "@/i18n/routing";
import "./globals.css";

export default function GlobalError({ reset }: { reset: () => void }) {
  const locale = useLocale();
  return (
    <html lang={documentLanguage(locale)}>
      <body>
        <StatusPage code="500" retry={reset} />
      </body>
    </html>
  );
}
