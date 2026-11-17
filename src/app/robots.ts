import type { MetadataRoute } from "next";
import { site } from "@/lib/metadata";

const closed = ["/api/", "/admin/", "/sign-in"];

/**
 * Bots that cite their sources in an answer. These are the ones that can send a
 * person to the shop, so they are named explicitly rather than left to the
 * wildcard — each product needs its own directive, and blocking one does not
 * block its siblings.
 */
const citing = [
  "Googlebot",
  "Googlebot-Image",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "DuckDuckBot",
];

/**
 * Bots that collect text for model training. Allowed deliberately: for a small
 * producer, being present in the corpus is reach, and refusing it removes the
 * chance of being named at all without protecting anything — the catalogue is
 * public either way. Revisit only if the client asks.
 */
const training = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  if (!site.production) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: closed },
      { userAgent: citing, allow: "/", disallow: closed },
      { userAgent: training, allow: "/", disallow: closed },
      // "Yandex" matches every Yandex crawler. Shut out by the client's decision,
      // not for SEO reasons; without this line the wildcard rule would admit it.
      { userAgent: "Yandex", disallow: "/" },
    ],
    sitemap: new URL("/sitemap.xml", site.url).toString(),
  };
}
