import type { NextConfig } from "next";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const replacedPhotos = {
  "editorial/journal/caviar-serving.webp":
    "editorial/journal/caviar-serving-card.webp",
  "editorial/journal/blog-serve.jpg":
    "editorial/journal/caviar-serving-card.webp",
  "gifts/tasting.webp": "gifts/tasting-full.webp",
  "editorial/story/bere-farm1.jpg": "editorial/story/bere-farm1.webp",
  "editorial/story/bere-img1696.jpg": "editorial/story/bere-img1696.webp",
  "editorial/story/hand-spoon.jpg": "editorial/story/hand-spoon.webp",
  "editorial/quality/step-cites.jpg": "editorial/quality/step-01.webp",
  "editorial/quality/step-lab.jpg": "editorial/quality/step-02.webp",
  "editorial/quality/step-jar.jpg": "editorial/quality/step-03.webp",
  "editorial/quality/step-label.jpg": "editorial/quality/step-04.webp",
  "faq-spoon.jpg": "faq-spoon.webp",
  "set-intro.jpg": "gifts/introduction.webp",
  "set-tasting.jpg": "gifts/tasting-full.webp",
  "set-premium.jpg": "gifts/premium.webp",
} as const;

/**
 * Old WordPress addresses, which still hold nearly all of what Search knows
 * about the shop, mapped to the pages that replaced them. A redirect to an
 * unrelated page is a soft 404 and loses the ranking, so each goes to its real
 * equivalent; `#` targets are home-page sections. English is enumerated, never
 * wildcarded — `/en/*` is the live storefront.
 */
const movedPages: { uk?: string; ru?: string; en?: string; to: string }[] = [
  {
    uk: "vidi-rib",
    ru: "vidy-ryby",
    en: "types-of-fish-2",
    to: "/journal/sturgeon-species",
  },
  { uk: "pro-nas", ru: "o-nas", en: "about-us", to: "#about" },
  {
    // The 2016 story is published in the blog section's company archive.
    uk: "azovskij-oseter-povertayetsya-dodomu",
    ru: "azovskij-osetr-vozvrashhaetsya-domoj",
    en: "azov-sturgeon-return-home",
    to: "#blog",
  },
  {
    uk: "istoriya-smaku",
    ru: "istoriya-vkusa",
    en: "history-of-taste",
    to: "#history",
  },
  { uk: "kontakti", ru: "kontakty", en: "contacts", to: "#contacts" },
  {
    uk: "produktsiya",
    ru: "produktsiya-kompanii-ukrainian-caviar-berry",
    en: "products",
    to: "#ikra",
  },
  {
    // Bester is HUSO HUSO × A. RUTHENUS — the species `hybrid` sells.
    uk: "produktsiya/ikra-bestera",
    ru: "produktsiya-kompanii-ukrainian-caviar-berry/ikra-bestera",
    en: "products/caviar-of-bester",
    to: "/products/hybrid",
  },
  {
    // `premium` is the only pack carrying A. gueldenstaedtii.
    uk: "produktsiya/ikra-rosijskogo-osetra",
    ru: "produktsiya-kompanii-ukrainian-caviar-berry/ikra-russkogo-osetra",
    en: "products/caviar-of-russian-sturgeon",
    to: "/products/premium",
  },
  {
    uk: "firmove-pakovannya-vid-ukrainian-caviar-berry",
    ru: "firmennaya-upakovka-ot-ukrainian-caviar-berry",
    to: "/journal/packing-and-delivery",
  },
  {
    // Annual grading of the broodstock — the blog section carries the 2020
    // footage of exactly this.
    uk: "shhorichne-bonituvannya-osetrovih",
    ru: "ezhegodnaya-bonitirovka-osetrovyh",
    en: "annual-sturgeon-grading",
    to: "#blog",
  },
  {
    // Only the English address reached Search; uk/ru fall to the wildcard.
    en: "ukrainian-armed-forces-rescue-endangered-stock-of-russian-sturgeon",
    to: "#blog",
  },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Bundle Firebase Admin so its CommonJS dependencies can load ESM on Vercel.
  transpilePackages: ["firebase-admin"],
  // Firestore's REST serializer relies on native protobuf/Long constructor names.
  serverExternalPackages: ["@google-cloud/firestore"],
  experimental: { globalNotFound: true },
  redirects() {
    const moved = movedPages.flatMap(({ uk, ru, en, to }) => [
      ...(uk ? [{ source: `/uk/${uk}`, destination: `/ua${to}` }] : []),
      ...(ru ? [{ source: `/ru/${ru}`, destination: `/ua${to}` }] : []),
      // English keeps its own locale.
      ...(en ? [{ source: `/en/${en}`, destination: `/en${to}` }] : []),
    ]);
    return [
      ...moved.map((rule) => ({ ...rule, permanent: true })),
      // Everything else those locales served. Last, so the named pages win.
      { source: "/:locale(uk|ru)", destination: "/ua", permanent: true },
      { source: "/:locale(uk|ru)/:path*", destination: "/ua", permanent: true },
    ];
  },
  images: {
    // Measured across the storefront at 1920/2x: the browser only ever asks for
    // 384, 828, 1080 and 1920. Every extra candidate is one more variant that
    // can be cold for the visitor who hits it first.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [128, 256, 384],
    qualities: [75, 90, 100],
    remotePatterns:
      cloudName && /^[a-z0-9-]+$/.test(cloudName)
        ? [
            {
              protocol: "https",
              hostname: "res.cloudinary.com",
              pathname: `/${cloudName}/image/upload/**`,
              search: "",
            },
          ]
        : [],
  },
  async rewrites() {
    return [
      {
        source:
          "/assets/img/:name(about-mama|farm-aerial-poster|hist-farm).jpg",
        destination: "/assets/img/editorial/story/:name.jpg",
      },
      {
        source:
          "/assets/img/:name(bere-farm2-poster|water-chernivtsi|water-stream|water-volyn|water-zakarpattia).jpg",
        destination: "/assets/img/editorial/quality/:name.jpg",
      },
      {
        source: "/assets/img/:name(blog-jar).jpg",
        destination: "/assets/img/editorial/journal/:name.jpg",
      },
      ...Object.entries(replacedPhotos).flatMap(([previous, current]) => {
        const destination = `/assets/img/${current}`;
        const path = previous.split("/").at(-1)!;
        return [
          { source: `/assets/img/${previous}`, destination },
          ...(previous.includes("/")
            ? [{ source: `/assets/img/${path}`, destination }]
            : []),
        ];
      }),
    ];
  },
  async headers() {
    const staffHeaders = [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          ...(process.env.APP_ENV !== "production" ||
          (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
      {
        source: "/assets/img/catalog-set/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Digested filenames, so a re-encode always publishes a new URL.
        source: "/assets/img/editorial-set/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      { source: "/admin/:path*", headers: staffHeaders },
      { source: "/sign-in", headers: staffHeaders },
    ];
  },
};
export default config;
