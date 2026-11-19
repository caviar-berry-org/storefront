import assert from "node:assert/strict";
import test from "node:test";
import { serverModule } from "../helpers/server-module.ts";

const telegram = serverModule<
  typeof import("../../src/lib/server/notify/telegram.ts")
>("src/lib/server/notify/telegram.ts", {});

test("a notification never carries a customer's address or number", () => {
  // Crash messages and stack frames quote whatever was submitted, so the sink
  // redacts rather than trusting its callers to.
  for (const [input, expected] of [
    ["Failed for anna.k+tag@example.com", "Failed for [email]"],
    ["phone +380 (99) 143-56-79 rejected", "phone [number] rejected"],
    ["card 4441 1144 2222 3333 declined", "card [number] declined"],
    ["CB-20261117-6EE726E5 refused", "CB-20261117-6EE726E5 refused"],
  ] as const)
    assert.equal(telegram.redact(input), expected, input);
});

test("values are bounded so one long error cannot fill the chat", () => {
  assert.ok(telegram.redact("x".repeat(5000)).length <= 300);
  assert.equal(telegram.redact(undefined), "");
  assert.equal(telegram.redact(null), "");
});

test("a disclosed ticket carries the contact and the customer's own words", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "-100123";
  const guard = globalThis.fetch;
  let body = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body)).text;
    return { ok: true } as Response;
  }) as unknown as typeof fetch;
  try {
    await telegram.notify(
      "submission",
      "Написати нам",
      {
        Контакт: "anna.k@example.com",
        Телефон: "+380 (99) 143-56-79",
        Товари: "Преміум, 50 г × 1\nСтерлядь, 100 г × 2",
      },
      { throttleKey: "ticket-disclosed", disclose: true },
    );
    assert.match(body, /anna\.k@example\.com/);
    assert.match(body, /\+380 \(99\) 143-56-79/);
    assert.match(body, /<b>Товари:<\/b>\nПреміум/);

    // The same fields without the opt-in stay redacted.
    await telegram.notify(
      "error",
      "checkout.unavailable",
      { Контакт: "anna.k@example.com", Телефон: "+380 (99) 143-56-79" },
      { throttleKey: "ticket-redacted" },
    );
    assert.doesNotMatch(body, /anna\.k@example\.com/);
    assert.match(body, /\[email\]/);
    assert.match(body, /\[number\]/);
  } finally {
    globalThis.fetch = guard;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
});

test("without both variables the sink stays silent and never reaches the network", async () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  try {
    assert.equal(telegram.telegramConfigured(), false);
    // Would throw on any fetch attempt: an unconfigured sink must not try.
    const guard = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("the sink reached the network without a configuration");
    }) as typeof fetch;
    try {
      assert.equal(
        await telegram.notify("error", "checkout.unavailable"),
        false,
      );
    } finally {
      globalThis.fetch = guard;
    }
  } finally {
    if (token !== undefined) process.env.TELEGRAM_BOT_TOKEN = token;
    if (chat !== undefined) process.env.TELEGRAM_CHAT_ID = chat;
  }
});

test("a repeated alert is throttled so a crash loop cannot flood the chat", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_CHAT_ID = "-100123";
  let sent = 0;
  const guard = globalThis.fetch;
  globalThis.fetch = (async () => {
    sent++;
    return { ok: true } as Response;
  }) as typeof fetch;
  try {
    const key = { throttleKey: "loop" };
    assert.equal(await telegram.notify("crash", "/boom", {}, key), true);
    await telegram.notify("crash", "/boom", {}, key);
    await telegram.notify("crash", "/boom", {}, key);
    assert.equal(sent, 1, "the same crash was announced more than once");
    // A different failure is its own news and still gets through.
    assert.equal(
      await telegram.notify("crash", "/other", {}, { throttleKey: "other" }),
      true,
    );
    assert.equal(sent, 2);
  } finally {
    globalThis.fetch = guard;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  }
});
