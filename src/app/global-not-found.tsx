"use client";
import { StatusPage } from "@/components/ui/status-page";
import { useLocale } from "@/i18n/client";
import { documentLanguage } from "@/i18n/routing";
import "./globals.css";

export default function GlobalNotFound() {
  const locale = useLocale();
  return (
    <html lang={documentLanguage(locale)}>
      <body>
        <StatusPage code="404" />
      </body>
    </html>
  );
}
