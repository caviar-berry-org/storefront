import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const firebaseKeys = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;
const cloudinaryKeys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

function checkEnvironment(
  env: Record<string, string | undefined>,
  production: boolean,
) {
  const issues: string[] = [];
  const has = (key: string) => Boolean(env[key]?.trim());
  const expected = production ? "production" : "development";

  if (env.APP_ENV !== expected) issues.push(`APP_ENV must be ${expected}.`);
  if (production && env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    issues.push("Production configuration requires VERCEL_ENV=production.");
  }

  const url = URL.parse(env.SITE_URL ?? "");
  if (
    !url ||
    !["http:", "https:"].includes(url.protocol) ||
    url.href !== `${url.origin}/` ||
    (production &&
      (url.protocol !== "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  ) {
    issues.push(
      production
        ? "SITE_URL must be an HTTPS origin outside localhost."
        : "SITE_URL must be an HTTP or HTTPS origin.",
    );
  }

  for (const key of firebaseKeys) {
    if (!has(key)) issues.push(`${key} is required for Firebase.`);
  }
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const email = env.FIREBASE_CLIENT_EMAIL?.trim();
  if (
    email &&
    (!projectId || !email.endsWith(`@${projectId}.iam.gserviceaccount.com`))
  ) {
    issues.push("FIREBASE_CLIENT_EMAIL must belong to FIREBASE_PROJECT_ID.");
  }
  const pem = env.FIREBASE_PRIVATE_KEY?.trim();
  if (pem) {
    try {
      const key = createPrivateKey(pem.replace(/\\n/g, "\n"));
      if (key.asymmetricKeyType !== "rsa") throw new Error();
    } catch {
      issues.push("FIREBASE_PRIVATE_KEY must be a valid RSA PEM private key.");
    }
  }

  const hasCloudinary = cloudinaryKeys.some(has);
  if (hasCloudinary) {
    for (const key of cloudinaryKeys) {
      if (!has(key))
        issues.push(`${key} is required when configuring Cloudinary.`);
    }
  }

  // Mail identity. The sender must be the SMTP mailbox itself, and production must not
  // reuse the DEV mailbox — the transport refuses it, so catch it here instead of at send.
  const sender = env.SMTP_USER?.trim().toLowerCase();
  const from = env.MAIL_FROM?.trim().toLowerCase();
  if (has("SMTP_USER") || has("MAIL_FROM")) {
    if (sender !== from)
      issues.push("MAIL_FROM must be the same mailbox as SMTP_USER.");
    if (production && sender === "dev-notify@caviar.net.ua")
      issues.push(
        "Production must not send from the DEV mailbox; create the production sender.",
      );
    // The apex record now points at the site host, which does not speak SMTP.
    // That breaks DEV exactly as it breaks production, so the rule is not gated
    // on the environment: mail always goes to the provider's own hostname.
    if (env.SMTP_HOST?.trim().toLowerCase() === "caviar.net.ua")
      issues.push(
        "SMTP_HOST must be the mail hostname (mail.caviar.net.ua), not the site domain.",
      );
    for (const key of ["SMTP_HOST", "SMTP_PASSWORD"])
      if (!has(key)) issues.push(`${key} is required for mail.`);
    if (env.SMTP_PORT !== "465" || env.SMTP_SECURE !== "true")
      issues.push("SMTP_PORT must be 465 with SMTP_SECURE=true.");
  }
  // Operator alerts are optional everywhere, but half a configuration is worse
  // than none: the sink stays silent and nobody notices it never spoke.
  if (has("TELEGRAM_BOT_TOKEN") !== has("TELEGRAM_CHAT_ID"))
    issues.push(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set together, or both left unset.",
    );
  for (const key of [
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_TOPIC_CRASH",
    "TELEGRAM_TOPIC_ERROR",
    "TELEGRAM_TOPIC_ORDER",
    "TELEGRAM_TOPIC_SUBMISSION",
    "TELEGRAM_TOPIC_DAILY",
  ])
    if (has(key) && !/^-?\d+$/.test(env[key]!.trim()))
      issues.push(`${key} must be a numeric Telegram id.`);

  if (
    has("MAIL_REPLY_TO") &&
    !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(env.MAIL_REPLY_TO!.trim())
  )
    issues.push("MAIL_REPLY_TO must be a single valid mailbox.");
  if (production && !has("MAIL_REPLY_TO"))
    issues.push(
      "MAIL_REPLY_TO must name the mailbox a human reads (for example sale@caviar.net.ua).",
    );

  if (env.CHECKOUT_ENABLED === "true") {
    for (const key of ["MONO_TOKEN", "NOVA_POSHTA_API_KEY"])
      if (!has(key)) issues.push(`${key} is required for checkout.`);
    if (env.MONO_MODE !== "test" && env.MONO_MODE !== "live")
      issues.push("MONO_MODE must be test or live.");
    if (production && env.MONO_MODE !== "live")
      issues.push("Production payments require live mode.");
    if (
      !production &&
      env.MONO_MODE === "live" &&
      env.ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT !== "true"
    )
      issues.push("DEV live payments require explicit opt-in.");
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 32)
      issues.push("CRON_SECRET must contain at least 32 random characters.");
  }
  if (issues.length > 0) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
    return;
  }

  console.log(`${expected} environment format checks passed.`);
  if (!hasCloudinary) console.log("Cloudinary is unset.");
  for (const key of ["MONO_TOKEN", "NOVA_POSHTA_API_KEY"]) {
    if (!has(key)) console.log(`${key} is unset.`);
  }
  if (env.CHECKOUT_ENABLED === "true" && url?.protocol !== "https:")
    console.log(
      "Online checkout is blocked on local HTTP; deploy a public HTTPS callback before live payment checks.",
    );
  console.log("Provider connections still require npm run providers:verify.");
}

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--production") {
  checkEnvironment(process.env, true);
} else if (args.length === 0) {
  try {
    const env = parseEnv(readFileSync(".env.local", "utf8"));
    checkEnvironment(env, false);
  } catch {
    console.error("Could not read .env.local.");
    process.exitCode = 1;
  }
} else {
  console.error("Usage: npm run env:check [-- --production]");
  process.exitCode = 1;
}
