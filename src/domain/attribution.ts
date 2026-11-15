/**
 * First-touch attribution: which channel brought the person who placed the
 * order. Stored on the records we already write, so measuring a channel costs
 * no extra database write.
 *
 * Everything here treats its input as hostile: the value arrives in a cookie the
 * visitor can edit, and it ends up inside a Firestore document and on an admin
 * screen. Hence the closed source list and the narrow character set.
 */
export const utmSources = [
  "instagram",
  "facebook",
  "threads",
  "tiktok",
  "youtube",
  "telegram",
  "google",
  "bing",
  "chatgpt",
  "perplexity",
  "gemini",
  "claude",
  "email",
  "offline",
  "other",
] as const;

export type UtmSource = (typeof utmSources)[number];

export type Attribution = {
  source: UtmSource;
  medium?: string;
  campaign?: string;
  /** When the visit that produced it happened, in epoch milliseconds. */
  firstSeenAt: number;
};

const fieldLimit = 40;
const safeField = /^[a-z0-9][a-z0-9._-]{0,39}$/;

export const isUtmSource = (value: unknown): value is UtmSource =>
  utmSources.some((source) => source === value);

function field(value: string | null): string | undefined {
  if (!value) return undefined;
  const text = value.trim().toLowerCase().slice(0, fieldLimit);
  return safeField.test(text) ? text : undefined;
}

/** Maps what a platform actually sends to one of our own source names. */
function knownSource(value: string | undefined): UtmSource | undefined {
  if (!value) return undefined;
  if (isUtmSource(value)) return value;
  const aliases: Record<string, UtmSource> = {
    ig: "instagram",
    fb: "facebook",
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "m.facebook.com": "facebook",
    "l.instagram.com": "instagram",
    "t.co": "other",
    twitter: "other",
    x: "other",
    yt: "youtube",
    "youtube.com": "youtube",
    "google.com": "google",
    googlesearch: "google",
    cpc: "google",
    tg: "telegram",
    "t.me": "telegram",
    openai: "chatgpt",
    "chat.openai.com": "chatgpt",
    "chatgpt.com": "chatgpt",
    "perplexity.ai": "perplexity",
    "gemini.google.com": "gemini",
    "claude.ai": "claude",
    anthropic: "claude",
    "tiktok.com": "tiktok",
    "threads.net": "threads",
    "threads.com": "threads",
  };
  return aliases[value];
}

/**
 * Reads a landing URL's query. `ref` is accepted as a short alias so a link
 * shared by hand stays usable; anything unrecognised becomes "other" rather
 * than being stored verbatim.
 */
export function parseAttribution(
  search: string,
  now: number,
): Attribution | null {
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(search);
  } catch {
    return null;
  }
  const raw = field(query.get("utm_source")) ?? field(query.get("ref"));
  if (!raw) return null;
  const source = knownSource(raw) ?? "other";
  const medium = field(query.get("utm_medium"));
  const campaign =
    field(query.get("utm_campaign")) ?? field(query.get("utm_content"));
  return {
    source,
    ...(medium && { medium }),
    ...(campaign && { campaign }),
    firstSeenAt: now,
  };
}

export const attributionCookie = "ucb-src";

export function serializeAttribution(value: Attribution) {
  const parts = [`s=${value.source}`, `t=${value.firstSeenAt}`];
  if (value.medium) parts.push(`m=${value.medium}`);
  if (value.campaign) parts.push(`c=${value.campaign}`);
  return parts.join("&");
}

/** Null for anything we did not write ourselves, however it was edited. */
export function readAttribution(
  cookie: string | undefined | null,
): Attribution | null {
  if (!cookie || cookie.length > 160) return null;
  const query = new URLSearchParams(cookie);
  const source = query.get("s");
  const at = Number(query.get("t"));
  if (!isUtmSource(source) || !Number.isSafeInteger(at) || at <= 0) return null;
  const medium = field(query.get("m"));
  const campaign = field(query.get("c"));
  return {
    source,
    ...(medium && { medium }),
    ...(campaign && { campaign }),
    firstSeenAt: at,
  };
}

/** The link a manager copies for one channel. */
export function utmLink(
  origin: string,
  path: string,
  source: UtmSource,
  options: { medium?: string; campaign?: string } = {},
) {
  const url = new URL(path, origin);
  url.searchParams.set("utm_source", source);
  if (options.medium) url.searchParams.set("utm_medium", options.medium);
  if (options.campaign) url.searchParams.set("utm_campaign", options.campaign);
  return url.href;
}
