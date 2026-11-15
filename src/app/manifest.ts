import type { MetadataRoute } from "next";
import { getTranslator } from "@/i18n";
import { defaultLocale } from "@/i18n/routing";

export default function manifest(): MetadataRoute.Manifest {
  const t = getTranslator(defaultLocale);
  return {
    name: "Ukrainian Caviar Berry",
    short_name: "Caviar Berry",
    description: t("layout.description1"),
    // The storefront is a site, not an app: no standalone display, no shortcuts.
    start_url: `/${defaultLocale}`,
    display: "browser",
    background_color: "#fbfaf7",
    theme_color: "#F2F2F2",
    icons: [
      { src: "/icon.png", sizes: "600x457", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
