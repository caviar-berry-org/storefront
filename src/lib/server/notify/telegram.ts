import "server-only";

/**
 * Operator notifications. A separate path from `logCommerce`: the log is the
 * durable record, this is the nudge that makes someone look at it.
 *
 * Three rules this file exists to keep:
 *  - it never breaks a request. Every failure is swallowed; a dead bot token
 *    must not cost a customer their checkout;
 *  - crash and error alerts carry no personal data: their text is written by
 *    whoever threw it. Order and submission tickets are the exception — the
 *    chat is staff-only and an operator needs the whole ticket. Opt in with
 *    `disclose`; the default redacts;
 *  - it never floods. A crash loop would otherwise post until Telegram rate
 *    limits us and the real signal is buried.
 *
 * Routing is per category from the environment, so moving a category into its
 * own forum topic is a config change, never a code change.
 */
export type NotifyCategory =
  "crash" | "error" | "order" | "submission" | "daily";

const topicVariable: Record<NotifyCategory, string> = {
  crash: "TELEGRAM_TOPIC_CRASH",
  error: "TELEGRAM_TOPIC_ERROR",
  order: "TELEGRAM_TOPIC_ORDER",
  submission: "TELEGRAM_TOPIC_SUBMISSION",
  daily: "TELEGRAM_TOPIC_DAILY",
};

const heading: Record<NotifyCategory, string> = {
  crash: "💥 Краш",
  error: "🔴 Помилка",
  order: "🧾 Замовлення",
  submission: "✉️ Заявка",
  daily: "📊 Зведення",
};

/** Telegram rejects anything longer; leave room for the heading and fields. */
const messageLimit = 3500;
const valueLimit = 300;
/** A disclosed ticket quotes the customer's own words, so it is given room. */
const discloseLimit = 1000;

const emailPattern = /[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+/g;
/**
 * A run long enough to be a phone, card or document number. The boundaries
 * matter as much as the run: an order number like CB-20261117-6EE726E5 holds
 * eight digits, and redacting it would delete the one fact the alert is for.
 */
const digitRunPattern = /(?<![\w-])[+(]?\d[\d\s()-]{7,}\d(?![\w-])/g;

/**
 * Error messages and stack frames are written by whoever threw them, so they
 * can contain anything a customer typed. Redact before the text leaves us.
 */
export function redact(value: unknown): string {
  return String(value ?? "")
    .replace(emailPattern, "[email]")
    .replace(digitRunPattern, "[number]")
    .slice(0, valueLimit);
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * Throttle state lives in module memory, so it is per serverless instance and
 * deliberately approximate. It exists to stop one looping instance flooding the
 * chat, not to enforce a global rate — that would need shared storage, and a
 * notification is not worth a Firestore write.
 */
const lastSent = new Map<string, number>();
const throttleMs = 60_000;
const throttleKeys = 200;

function throttled(key: string, now: number) {
  const previous = lastSent.get(key);
  if (previous !== undefined && now - previous < throttleMs) return true;
  // Bounded: drop the oldest key rather than grow without limit.
  if (lastSent.size >= throttleKeys) {
    const oldest = [...lastSent.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) lastSent.delete(oldest[0]);
  }
  lastSent.set(key, now);
  return false;
}

export function telegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
    process.env.TELEGRAM_CHAT_ID?.trim(),
  );
}

export type NotifyFields = Record<string, unknown>;

/**
 * Sends one notification. Resolves to whether it was delivered, and never
 * rejects: callers log their own event and must not care about the chat.
 */
export async function notify(
  category: NotifyCategory,
  title: string,
  fields: NotifyFields = {},
  options: { throttleKey?: string; disclose?: boolean } = {},
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat) return false;

  const key = `${category}:${options.throttleKey ?? title}`;
  if (throttled(key, Date.now())) return false;

  const show = (value: unknown) =>
    options.disclose
      ? escapeHtml(String(value ?? "")).slice(0, discloseLimit)
      : escapeHtml(redact(value));
  const lines = Object.entries(fields)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([name, value]) => {
      // A multi-line value — items, an address — keeps its lines.
      const text = show(value);
      return `<b>${escapeHtml(name)}:</b>${text.includes("\n") ? "\n" : " "}${text}`;
    });
  // Production and DEV share one chat on purpose — two chats mean two places to
  // forget to look. The marker is what keeps a DEV crash from reading as a real one.
  const environment = process.env.APP_ENV === "production" ? "" : " [DEV]";
  const text = [`${heading[category]}${environment} · ${show(title)}`, ...lines]
    .join("\n")
    .slice(0, messageLimit);

  const topic = process.env[topicVariable[category]]?.trim();
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(topic && { message_thread_id: Number(topic) }),
        }),
        // A hanging chat API must not eat the route's whole duration budget.
        signal: AbortSignal.timeout(5000),
      },
    );
    return response.ok;
  } catch {
    // Deliberately silent: logging here could recurse into this same sink.
    return false;
  }
}
