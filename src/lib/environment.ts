export function siteEnvironment(env: Record<string, string | undefined>) {
  const production =
    env.APP_ENV === "production" &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === "production");
  const url = new URL(env.SITE_URL || "http://localhost:3000");
  if (production && (url.protocol !== "https:" || url.hostname === "localhost"))
    throw new Error("Production requires an HTTPS SITE_URL.");
  return { production, url };
}
