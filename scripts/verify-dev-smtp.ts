import nextEnv from "@next/env";
import nodemailer from "nodemailer";

class ConfigurationError extends Error {}

async function verify() {
  if (process.argv.length > 2)
    throw new ConfigurationError("Usage: npm run mail:verify");

  // Match Next's expansion rules, including escaped dollar signs in passwords.
  nextEnv.loadEnvConfig(process.cwd(), true, {
    info() {},
    error() {
      throw new ConfigurationError("Could not load local environment files.");
    },
  });

  const env = process.env;
  if (
    env.APP_ENV !== "development" ||
    (env.VERCEL_ENV && env.FIREBASE_PROJECT_ID !== "caviar-berry-dev") ||
    env.SMTP_USER?.trim() !== "dev-notify@caviar.net.ua"
  )
    throw new ConfigurationError(
      "Use APP_ENV=development and the dev-notify@caviar.net.ua mailbox only.",
    );

  const host = env.SMTP_HOST?.trim();
  if (!host || !/^[a-z\d.-]+$/i.test(host) || !env.SMTP_PASSWORD)
    throw new ConfigurationError("SMTP_HOST and SMTP_PASSWORD are required.");
  if (env.SMTP_PORT !== "465" || env.SMTP_SECURE !== "true")
    throw new ConfigurationError(
      "This DEV check requires SMTP_PORT=465 and SMTP_SECURE=true.",
    );

  const transport = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASSWORD },
    forceAuth: true,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dnsTimeout: 10_000,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  });

  try {
    // verify authenticates and quits; it does not submit an SMTP message.
    await transport.verify();
    console.log("DEV SMTP: TLS and authentication passed. No email sent.");
  } finally {
    transport.close();
  }
}

try {
  await verify();
} catch (error) {
  if (error instanceof ConfigurationError) console.error(error.message);
  else {
    // Provider responses can include addresses; print only known error classes.
    const code = (error as { code?: unknown } | null)?.code;
    const reason =
      code === "EAUTH"
        ? "Authentication failed; check the mailbox credentials locally."
        : code === "ETIMEDOUT"
          ? "Connection timed out; check SMTP access and server availability."
          : code === "EDNS"
            ? "SMTP hostname could not be resolved."
            : code === "ESOCKET" || code === "ECONNECTION"
              ? "TLS or network connection failed; certificate validation remains enabled."
              : "Connection or authentication failed.";
    console.error(`DEV SMTP: ${reason} No email sent.`);
  }
  process.exitCode = 1;
}
