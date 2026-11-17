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

const config: NextConfig = {
  poweredByHeader: false,
  // Bundle Firebase Admin so its CommonJS dependencies can load ESM on Vercel.
  transpilePackages: ["firebase-admin"],
  // Firestore's REST serializer relies on native protobuf/Long constructor names.
  serverExternalPackages: ["@google-cloud/firestore"],
  experimental: { globalNotFound: true },
  /**
   * The WordPress site served Ukrainian under `/uk`; this one uses `/ua`.
   * Without these, every Ukrainian address Google indexed over the years dies
   * as a 404 and its weight is lost — the English side was spared only because
   * `/en` happened to match. Declared here rather than in the proxy so the edge
   * answers them without waking a function.
   */
  redirects() {
    return [
      { source: "/uk", destination: "/ua", permanent: true },
      { source: "/uk/:path*", destination: "/ua/:path*", permanent: true },
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
