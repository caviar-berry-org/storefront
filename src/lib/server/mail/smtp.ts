import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { contacts } from "../../../content/contacts.ts";

type Environment = Record<string, string | undefined>;
// Inline artwork travels as a base64 CID part: `disableFileAccess`/`disableUrlAccess` stay on,
// so nodemailer never reads a path or fetches a URL on our behalf.
export type MailAttachment = {
  filename: string;
  cid: string;
  contentType: string;
  base64: string;
};
export type MailMessage = {
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
};

export class MailError extends Error {
  readonly code: "CONFIGURATION" | "RECIPIENT" | "SMTP";
  readonly uncertain: boolean;
  constructor(code: "CONFIGURATION" | "RECIPIENT" | "SMTP", uncertain = false) {
    super(`Mail service: ${code}`);
    this.code = code;
    this.uncertain = uncertain;
  }
}

export function mailbox(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    /^[^\s@<>,;:"\\]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(email)
    ? email
    : null;
}

/**
 * `pooled` keeps one authenticated connection alive across a batch. Shared mail
 * hosting caps connections per hour, so a run of twenty letters must not open
 * twenty TLS sessions. A pooled transport must be closed by its owner.
 */
export function smtpTransport(env: Environment = process.env, pooled = false) {
  if (
    !["development", "production"].includes(env.APP_ENV ?? "") ||
    (env.APP_ENV === "development" &&
      env.VERCEL_ENV &&
      env.FIREBASE_PROJECT_ID !== "caviar-berry-dev") ||
    (env.APP_ENV === "production" &&
      (env.FIREBASE_PROJECT_ID === "caviar-berry-dev" ||
        env.SMTP_USER?.trim() === "dev-notify@caviar.net.ua")) ||
    !mailbox(env.SMTP_USER) ||
    !env.SMTP_HOST ||
    !/^[a-z\d.-]+$/i.test(env.SMTP_HOST) ||
    !env.SMTP_PASSWORD ||
    env.SMTP_PORT !== "465" ||
    env.SMTP_SECURE !== "true"
  )
    throw new MailError("CONFIGURATION");

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: 465,
    secure: true,
    ...(pooled && { pool: true, maxConnections: 2, maxMessages: 50 }),
    auth: { user: env.SMTP_USER!.trim(), pass: env.SMTP_PASSWORD },
    forceAuth: true,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    dnsTimeout: 5_000,
    connectionTimeout: 8_000,
    greetingTimeout: 5_000,
    socketTimeout: 8_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export function testRecipients(env: Environment = process.env) {
  const values = (env.MAIL_TEST_RECIPIENTS ?? "").split(",");
  const recipients = values.map(mailbox);
  if (!recipients.length || recipients.some((email) => !email))
    throw new MailError("CONFIGURATION");
  return [...new Set(recipients as string[])];
}

export function assertMailRecipient(
  to: string,
  env: Environment = process.env,
  purpose: "test" | "promotion" | "order" | "owner" | "restock" = "test",
) {
  const recipient = mailbox(to);
  const publicDelivery =
    (purpose === "promotion" && env.PROMOTION_PUBLIC_ENABLED === "true") ||
    (purpose === "owner" &&
      env.OWNER_EMAIL_ENABLED === "true" &&
      (env.OWNER_NOTIFICATION_EMAILS ?? "")
        .split(",")
        .some((email) => mailbox(email) === recipient)) ||
    (purpose === "restock" && env.RESTOCK_EMAIL_ENABLED === "true") ||
    (purpose === "order" && env.ORDER_EMAIL_ENABLED === "true");
  if (
    !recipient ||
    (!publicDelivery && !testRecipients(env).includes(recipient))
  )
    throw new MailError("RECIPIENT");
  if (mailbox(env.MAIL_FROM) !== mailbox(env.SMTP_USER))
    throw new MailError("CONFIGURATION");
  return recipient;
}

export type MailTransport = ReturnType<typeof smtpTransport>;

export async function sendMail(
  to: string,
  message: MailMessage,
  eventId: string,
  options: {
    env?: Environment;
    purpose?: "test" | "promotion" | "order" | "owner" | "restock";
    /** A pooled transport owned by the caller; it is not closed here. */
    transport?: MailTransport;
  } = {},
) {
  const env = options.env ?? process.env;
  const recipient = assertMailRecipient(to, env, options.purpose);
  const transport = options.transport ?? smtpTransport(env);
  const from = mailbox(env.MAIL_FROM)!;
  const id = createHash("sha256").update(eventId).digest("hex");
  const messageId = `<${id}@${from.split("@")[1]}>`;
  try {
    const result = await transport.sendMail({
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.attachments?.length && {
        attachments: message.attachments.map((file) => ({
          filename: file.filename,
          cid: file.cid,
          contentType: file.contentType,
          content: file.base64,
          encoding: "base64" as const,
          contentDisposition: "inline" as const,
        })),
      }),
      from: {
        name:
          env.APP_ENV === "production" ? "Caviar Berry" : "Caviar Berry DEV",
        address: from,
      },
      to: { address: recipient, name: "" },
      replyTo: {
        // Customers answer a mailbox a human reads; the sending account stays separate.
        // Falls back to the published address in production and to the sender in DEV,
        // so an unset or malformed value can never send replies somewhere unmonitored.
        address:
          mailbox(env.MAIL_REPLY_TO) ??
          (env.APP_ENV === "production" ? contacts.email : from),
        name: "Caviar Berry",
      },
      envelope: { from, to: [recipient] },
      messageId,
    });
    if (result.rejected.length || result.accepted.length !== 1)
      throw new MailError("SMTP");
    return { messageId };
  } catch (error) {
    // Never expose SMTP responses or recipient addresses through logs/API errors.
    if (error instanceof MailError) throw error;
    const command = (error as { command?: string } | null)?.command;
    // A disconnect during/after DATA can leave acceptance unknown: don't auto-retry.
    const safeToRetry =
      typeof command === "string" &&
      /^(CONN|AUTH|EHLO|HELO|STARTTLS|MAIL FROM|RCPT TO)/.test(command);
    throw new MailError("SMTP", !safeToRetry);
  } finally {
    if (!options.transport) transport.close();
  }
}
