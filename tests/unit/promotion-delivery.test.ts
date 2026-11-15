import assert from "node:assert/strict";
import { promotionCampaign } from "../../src/domain/promotion.ts";
import test from "node:test";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { serverModule } from "../helpers/server-module.ts";
import {
  MailError,
  assertMailRecipient,
  smtpTransport,
} from "../../src/lib/server/mail/smtp.ts";
import { promotionMessage } from "../../src/lib/server/mail/templates.ts";

function fixture(t: { after: (fn: () => void) => void }) {
  const previous = process.env.PROMOTION_EMAIL_ENABLED;
  process.env.PROMOTION_EMAIL_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.PROMOTION_EMAIL_ENABLED;
    else process.env.PROMOTION_EMAIL_ENABLED = previous;
  });
  const rows = new Map<string, Record<string, unknown>>();
  let sends = 0;
  let send: () => Promise<void> = async () => {};
  let failAcceptedWrite = false;
  const messages: string[] = [];
  const ref = (path: string) => ({
    path,
    collection: (name: string) => ({
      doc: (id: string) => ref(`${path}/${name}/${id}`),
    }),
    update: async (data: Record<string, unknown>) => {
      if (failAcceptedWrite && data.state === "accepted")
        throw new Error("offline");
      rows.set(path, { ...rows.get(path), ...data });
    },
  });
  let tail = Promise.resolve();
  const db = {
    runTransaction: (run: (tx: unknown) => Promise<unknown>) => {
      const result = tail.then(async () => {
        const writes: (() => void)[] = [];
        const value = await run({
          get: async ({ path }: { path: string }) => {
            assert.equal(writes.length, 0);
            return {
              exists: rows.has(path),
              data: () => rows.get(path),
              get: (key: string) => rows.get(path)?.[key],
            };
          },
          create: ({ path }: { path: string }, data: Record<string, unknown>) =>
            writes.push(() => {
              assert.ok(!rows.has(path));
              rows.set(path, data);
            }),
          set: (
            { path }: { path: string },
            data: Record<string, unknown>,
            options?: { merge: boolean },
          ) =>
            writes.push(() =>
              rows.set(
                path,
                options?.merge ? { ...rows.get(path), ...data } : data,
              ),
            ),
        });
        writes.forEach((write) => write());
        return value;
      });
      tail = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  };
  const service = serverModule<
    typeof import("../../src/lib/server/promotions/issue.ts")
  >("src/lib/server/promotions/issue.ts", {
    [resolve("src/lib/server/promotions/storage.ts")]: {
      campaign: "test",
      emailKey: (email: string) => email,
      promotionBook: () => ref("book"),
      promotionDatabase: () => db,
      promotionLifetime: 90 * 24 * 60 * 60 * 1000,
    },
    [resolve("src/lib/server/mail/smtp.ts")]: {
      MailError,
      assertMailRecipient: (email: string) => {
        if (email !== "test@example.com") throw new MailError("RECIPIENT");
        return email;
      },
      sendMail: async (_to: string, message: { text: string }) => {
        sends++;
        messages.push(message.text);
        await send();
        return { messageId: "stable-id" };
      },
    },
  });
  return {
    ...service,
    rows,
    messages,
    sends: () => sends,
    issue: () => rows.get("book/issues/test@example.com")!,
    setSend: (next: typeof send) => {
      send = next;
    },
    failAcceptedWrite: () => {
      failAcceptedWrite = true;
    },
  };
}

test("one issuance and one accepted email per address, with issued percent and 90-day expiry", async (t) => {
  const f = fixture(t);
  f.rows.set("book/settings/general", {
    enabled: true,
    percent: 15,
    revision: 1,
  });
  assert.deepEqual(await f.issuePromotion("test@example.com", "en"), {
    alreadySent: false,
  });
  const code = f.issue().code;
  assert.deepEqual(f.rows.get(`book/codes/${code}`)?.excludedProductIds, []);
  assert.ok(
    Number(f.issue().expiresAt) > Date.now() + 89 * 24 * 60 * 60 * 1000,
  );
  assert.match(f.messages[0]!, /15%/);
  assert.match(f.messages[0]!, /Your discount code: UCB-/);
  f.rows.set("book/settings/general", {
    enabled: true,
    percent: 20,
    revision: 2,
  });
  assert.deepEqual(await f.issuePromotion("test@example.com", "ua"), {
    alreadySent: true,
  });
  assert.equal(f.sends(), 1);
  assert.equal(f.issue().code, code);
  assert.equal(f.rows.get(`book/codes/${code}`)?.percent, 15);
});

test("parallel submissions cannot send duplicate emails", async (t) => {
  const f = fixture(t);
  let release!: () => void;
  let sending!: () => void;
  const started = new Promise<void>((resolve) => {
    sending = resolve;
  });
  f.setSend(() => {
    sending();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  const first = f.issuePromotion("test@example.com", "ua");
  await started;
  await assert.rejects(f.issuePromotion("test@example.com", "ua"));
  release();
  await first;
  assert.equal(f.sends(), 1);
});

test("safe SMTP failures preserve the code and impose a retry cooldown", async (t) => {
  const f = fixture(t);
  f.setSend(async () => {
    throw new MailError("SMTP");
  });
  await assert.rejects(f.issuePromotion("test@example.com", "ua"));
  const code = f.issue().code;
  await assert.rejects(
    f.issuePromotion("test@example.com", "ua"),
    (error: unknown) => (error as { limited: boolean }).limited,
  );
  f.issue().lastAttemptAt = Number(f.issue().lastAttemptAt) - 61_000;
  f.setSend(async () => {});
  await f.issuePromotion("test@example.com", "ua");
  assert.equal(f.issue().code, code);
  assert.equal(f.sends(), 2);
});

test("ambiguous SMTP acceptance or failed accepted-state write never auto-resends", async (t) => {
  for (const uncertain of [true, false]) {
    const f = fixture(t);
    if (uncertain)
      f.setSend(async () => {
        throw new MailError("SMTP", true);
      });
    else f.failAcceptedWrite();
    await assert.rejects(f.issuePromotion("test@example.com", "ua"));
    await assert.rejects(f.issuePromotion("test@example.com", "en"));
    assert.equal(f.sends(), 1);
    assert.equal(f.issue().state, uncertain ? "unknown" : "sending");
  }
});

test("disabled issuance and recipients outside the DEV allowlist cannot send", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.issuePromotion("other@example.com", "ua"));
  assert.equal(f.rows.size, 0);
  f.rows.set("book/settings/general", {
    enabled: false,
    percent: 10,
    revision: 1,
  });
  await assert.rejects(f.issuePromotion("test@example.com", "ua"));
  assert.equal(f.sends(), 0);
  assert.throws(() =>
    assertMailRecipient("other@example.com", {
      MAIL_FROM: "dev-notify@caviar.net.ua",
      SMTP_USER: "dev-notify@caviar.net.ua",
      MAIL_TEST_RECIPIENTS: "test@example.com",
    }),
  );
});

test("templates follow submission locale, escape HTML and omit unagreed expiry", () => {
  const ua = promotionMessage("ua", "<script>", 10, null);
  const en = promotionMessage("en", "<script>", 10, null);
  assert.match(ua.text, /Ваш промокод/);
  assert.match(en.text, /Your discount code/);
  assert.match(ua.html, /lang="uk"/);
  assert.match(en.html, /lang="en"/);
  assert.ok(!ua.html.includes("<script>"));
  assert.match(en.html, /&lt;script&gt;/);
  assert.ok(!ua.text.includes("Код діє до"));
  // Scope wording follows the admin setting rather than naming products blindly.
  assert.match(ua.text, /діє на всі товари/);
  assert.match(
    promotionMessage("ua", "X", 10, null, ["Ікра форелі"]).text,
    /Ікра форелі/,
  );
  // The transferability line the client asked us to drop must not come back.
  assert.ok(!ua.text.includes("передати"));
  assert.ok(!en.text.includes("share the code"));
});

test("Vercel primary DEV deployment is allowed without enabling the real production environment", () => {
  const env = {
    APP_ENV: "development",
    VERCEL_ENV: "production",
    FIREBASE_PROJECT_ID: "caviar-berry-dev",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "dev-notify@caviar.net.ua",
    SMTP_PASSWORD: "offline-test-only",
  };
  smtpTransport(env).close();
  assert.throws(() => smtpTransport({ ...env, APP_ENV: "production" }));
  assert.throws(() =>
    smtpTransport({ ...env, FIREBASE_PROJECT_ID: "production-project" }),
  );
});

test("public promo delivery accepts arbitrary single mailboxes while diagnostic mail stays allowlisted", () => {
  const env = {
    MAIL_FROM: "dev-notify@caviar.net.ua",
    SMTP_USER: "dev-notify@caviar.net.ua",
    MAIL_TEST_RECIPIENTS: "test@example.com",
    PROMOTION_PUBLIC_ENABLED: "true",
  };
  assert.equal(
    assertMailRecipient(" Another@Example.org ", env, "promotion"),
    "another@example.org",
  );
  assert.throws(() => assertMailRecipient("another@example.org", env));
  assert.throws(() =>
    assertMailRecipient(
      "another@example.org",
      { ...env, PROMOTION_PUBLIC_ENABLED: "false" },
      "promotion",
    ),
  );
  assert.throws(() =>
    assertMailRecipient("a@example.org,b@example.org", env, "promotion"),
  );
  assert.throws(() =>
    assertMailRecipient(
      "a@example.org\r\nBcc: b@example.org",
      env,
      "promotion",
    ),
  );
});

test("issued codes preserve their percent, are transferable and reject missing expiry", async (t) => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "development";
  t.after(() => {
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
  });
  const code = {
    campaign: promotionCampaign,
    percent: 15,
    expiresAt: (Date.now() + 86400000) as number | null | undefined,
    emailKey: createHash("sha256").update("test@example.com").digest("hex"),
  };
  const { validatePromotion } = serverModule<
    typeof import("../../src/lib/server/promotions/validate.ts")
  >("src/lib/server/promotions/validate.ts", {
    [resolve("src/lib/server/firestore.ts")]: {
      firebaseAdminDatabase: () => ({
        doc: () => ({
          collection: () => ({
            doc: () => ({ get: async () => ({ data: () => code }) }),
          }),
        }),
      }),
    },
  });
  const project = process.env.FIREBASE_PROJECT_ID;
  process.env.FIREBASE_PROJECT_ID = "caviar-berry-dev";
  t.after(() => {
    if (project === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = project;
  });
  assert.deepEqual(await validatePromotion("UCB-EXAMPLE"), {
    status: "valid",
    promotion: {
      code: "UCB-EXAMPLE",
      percent: 15,
      excludedProductIds: ["trout"],
    },
  });
  assert.deepEqual(await validatePromotion("UCB-EXAMPLE"), {
    status: "valid",
    promotion: {
      code: "UCB-EXAMPLE",
      percent: 15,
      excludedProductIds: ["trout"],
    },
  });
  code.expiresAt = undefined;
  assert.deepEqual(await validatePromotion("UCB-EXAMPLE"), {
    status: "invalid",
  });
  code.expiresAt = Date.now() - 1;
  assert.deepEqual(await validatePromotion("UCB-EXAMPLE"), {
    status: "invalid",
  });
  process.env.APP_ENV = "production";
  assert.deepEqual(await validatePromotion("UCB-EXAMPLE"), {
    status: "unavailable",
  });
});

test("newsletter rejects wrong origins, honeypots and invalid email; failures remain localized", async () => {
  let issued = 0;
  const { POST } = serverModule<
    typeof import("../../src/app/api/newsletter/route.ts")
  >("src/app/api/newsletter/route.ts", {
    [resolve("src/lib/server/promotion-customer.ts")]: {
      recordPromotionCustomer: async () => {},
    },
    [resolve("src/lib/server/promotions/issue.ts")]: {
      PromotionDeliveryError: class extends Error {},
      issuePromotion: async () => {
        issued++;
        return { alreadySent: issued > 1 };
      },
    },
  });
  const request = (
    data: unknown,
    locale = "ua",
    origin = "http://localhost:3000",
  ) =>
    new Request("http://localhost:3000/api/newsletter", {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "X-Storefront-Locale": locale,
      },
      body: JSON.stringify(data),
    });
  assert.equal((await POST(request({ email: "bad" }))).status, 422);
  assert.equal(
    (await POST(request({ email: "test@example.com", website: "spam" })))
      .status,
    400,
  );
  assert.equal(
    (
      await POST(
        request({ email: "test@example.com" }, "en", "https://other.test"),
      )
    ).status,
    400,
  );
  assert.equal(issued, 0);
  for (const locale of ["ua", "en"]) {
    const response = await POST(
      request({ email: "test@example.com", website: "" }, locale),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).sent, true);
  }
});

test("customer mail flags enable order/restock delivery while owner mail stays restricted to configured recipients", () => {
  const env = {
    APP_ENV: "development",
    MAIL_FROM: "dev-notify@caviar.net.ua",
    SMTP_USER: "dev-notify@caviar.net.ua",
    MAIL_TEST_RECIPIENTS: "test@example.com",
    ORDER_EMAIL_ENABLED: "true",
    RESTOCK_EMAIL_ENABLED: "true",
    OWNER_EMAIL_ENABLED: "true",
    OWNER_NOTIFICATION_EMAILS: "owner@example.com",
  };
  assert.equal(
    assertMailRecipient("customer@example.com", env, "order"),
    "customer@example.com",
  );
  assert.equal(
    assertMailRecipient("customer@example.com", env, "restock"),
    "customer@example.com",
  );
  assert.equal(
    assertMailRecipient("owner@example.com", env, "owner"),
    "owner@example.com",
  );
  assert.throws(() =>
    assertMailRecipient("customer@example.com", env, "owner"),
  );
  assert.throws(() => assertMailRecipient("customer@example.com", env, "test"));
});

test("DEV promotion mail uses a single subject marker and production body with actionable footer links", () => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = "development";
  try {
    for (const locale of ["ua", "en"] as const) {
      const mail = promotionMessage(
        locale,
        "UCB-CODE",
        12,
        Date.now() + 86400000,
      );
      assert.match(mail.subject, /^\[TEST\] /);
      assert.equal(mail.subject.match(/\[TEST\]/g)?.length, 1);
      assert.ok(!mail.text.includes("[TEST]"));
      // Artwork must stay embedded: a remote image is blocked by default in most
      // clients and would leak a read signal back to the sender. Every image in
      // the message has to resolve from an attachment, not just one of them.
      const sources = [...mail.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(
        (match) => match[1]!,
      );
      assert.equal(sources.length, 2, "emblem and closing banner");
      assert.ok(sources.every((src) => src.startsWith("cid:")));
      const cids = (mail.attachments ?? []).map((file) => `cid:${file.cid}`);
      assert.deepEqual([...sources].sort(), [...cids].sort());
      assert.deepEqual(
        (mail.attachments ?? []).map((file) => file.contentType).sort(),
        ["image/jpeg", "image/png"],
      );
      // The privacy link left the footer on the client's instruction (14.11);
      // the site and the contacts stay, so the letter is still actionable.
      assert.ok(!mail.html.includes("offer#privacy"));
      // Derived from the same setting the letter uses: CI runs with a local
      // SITE_URL, and a hard-coded host made this pass locally and fail there.
      const site = (process.env.SITE_URL ?? "https://caviar.net.ua").replace(
        /\/$/,
        "",
      );
      assert.ok(mail.html.includes(`href="${site}/${locale}"`));
      assert.match(mail.html, /href="mailto:sale@caviar.net.ua"/);
      assert.match(mail.html, /href="tel:\+380981944248"/);
      assert.match(mail.html, /role="presentation"/);
    }
  } finally {
    process.env.APP_ENV = previous;
  }
});
