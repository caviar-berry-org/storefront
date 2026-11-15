import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  validateCheckout,
  type CheckoutInput,
} from "../../src/domain/checkout.ts";
import {
  kyivDate,
  nextCalendarDate,
  validateInquiry,
  type InquiryInput,
} from "../../src/domain/inquiry.ts";
import { siteEnvironment } from "../../src/lib/environment.ts";
import { serverModule } from "../helpers/server-module.ts";
const contact: CheckoutInput = {
  name: "Тестова Покупчиня",
  phone: "+380 (98) 111-22-33",
  email: "test@example.com",
  city: "Київ",
  address: "Відділення 1",
  delivery: "branch",
  comment: "",
  consent: true,
};
test("checkout accepts complete data and preserves local or international phone formats", () => {
  assert.deepEqual(validateCheckout(contact), {});
  assert.ok(validateCheckout({ ...contact, delivery: "postomat" }).delivery);
  assert.deepEqual(validateCheckout({ ...contact, payment: "invoice" }), {});
  assert.ok(validateCheckout({ ...contact, payment: "unknown" }).payment);
  assert.equal(normalizePhone(contact.phone), "+380981112233");
  assert.equal(normalizePhone("0981112233"), "0981112233");
  assert.equal(normalizePhone("letters0981112233"), null);
});
test("checkout rejects missing consent, malformed contacts and oversized comments", () => {
  const errors = validateCheckout({
    ...contact,
    name: "A",
    phone: "+380",
    email: "wrong",
    city: "",
    address: "",
    consent: false,
    comment: "x".repeat(1001),
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "address",
    "city",
    "comment",
    "consent",
    "email",
    "name",
    "phone",
  ]);
});
const inquiry: InquiryInput = {
  name: "Тестова Покупчиня",
  contact: "+380981112233",
  date: "2026-12-01",
  comment: "",
  consent: true,
};
test("gift requests require real phone and consent but allow an optional delivery date", () => {
  assert.deepEqual(validateInquiry(inquiry, "gift", "2026-11-06"), {});
  assert.deepEqual(
    validateInquiry({ ...inquiry, date: "" }, "gift", "2026-11-06"),
    {},
  );
  assert.equal(
    validateInquiry(
      { ...inquiry, contact: "test@example.com" },
      "gift",
      "2026-11-06",
    ).contact,
    "phone",
  );
  assert.equal(
    validateInquiry({ ...inquiry, date: "2026-01-01" }, "gift", "2026-11-06")
      .date,
    "date",
  );
  assert.equal(
    validateInquiry({ ...inquiry, consent: false }, "gift", "2026-11-06")
      .consent,
    "consent",
  );
});
test("contact requests accept email and require a message", () => {
  assert.deepEqual(
    validateInquiry(
      { ...inquiry, contact: "test@example.com", comment: "Моє запитання" },
      "write",
      "2026-11-06",
    ),
    {},
  );
  assert.equal(
    validateInquiry(inquiry, "write", "2026-11-06").comment,
    "message",
  );
});
test("back-in-stock requests accept short names and require an email", () => {
  const data = { ...inquiry, name: "Ан", contact: "anna+shop@example.com" };
  assert.deepEqual(validateInquiry(data, "notify", "2026-11-06"), {});
  assert.deepEqual(
    validateInquiry({ ...data, name: "Анна Котлер" }, "notify", "2026-11-06"),
    {},
  );
  for (const invalid of [
    "",
    inquiry.contact,
    "a@b..com",
    "a..b@example.com",
    "a@-b.com",
  ]) {
    assert.equal(
      validateInquiry({ ...data, contact: invalid }, "notify", "2026-11-06")
        .contact,
      "email",
    );
  }
  assert.equal(
    validateInquiry({ ...data, name: " А " }, "notify", "2026-11-06").name,
    "notifyName",
  );
});
test("preview stays non-indexable even if APP_ENV is accidentally production", () => {
  assert.equal(
    siteEnvironment({
      APP_ENV: "production",
      VERCEL_ENV: "preview",
      SITE_URL: "https://preview.example.com",
    }).production,
    false,
  );
  assert.throws(() => siteEnvironment({ APP_ENV: "production" }), /HTTPS/);
});

test("inquiry validation rejects impossible calendar dates and letters in phone numbers", () => {
  for (const date of ["2027-02-30", "2027-99-99", "not-a-date"])
    assert.equal(
      validateInquiry({ ...inquiry, date }, "gift", "2026-11-06").date,
      "dateFormat",
    );
  assert.equal(
    validateInquiry(
      { ...inquiry, contact: "letters+380981112233" },
      "gift",
      "2026-11-06",
    ).contact,
    "phone",
  );
});

test("a preferred delivery date is optional and starts tomorrow in Kyiv", () => {
  const today = kyivDate(new Date("2026-12-31T21:59:00Z"));
  assert.equal(today, "2026-12-31");
  const tomorrow = nextCalendarDate(today);
  assert.equal(tomorrow, "2027-01-01");
  assert.equal(
    validateInquiry({ ...inquiry, date: today }, "gift", today).date,
    "date",
  );
  for (const date of ["", tomorrow, "2035-01-01"])
    assert.deepEqual(validateInquiry({ ...inquiry, date }, "gift", today), {});
  assert.equal(
    validateInquiry(
      { ...inquiry, date: tomorrow },
      "gift",
      kyivDate(new Date("2026-12-31T22:00:00Z")),
    ).date,
    "date",
  );
});

test("checkout and inquiries accept international and local phone formats without guessing a country", () => {
  for (const number of [
    "981112233",
    "098 111 22 33",
    "380981112233",
    "00380981112233",
    "+38 (098) 111-22-33",
  ])
    assert.ok(normalizePhone(number));

  for (const number of ["+48 512 345 678", "0048512345678", "48512345678"]) {
    assert.ok(normalizePhone(number));
    assert.deepEqual(
      validateInquiry({ ...inquiry, contact: number }, "gift", "2026-11-06"),
      {},
    );
    assert.deepEqual(
      validateInquiry(
        { ...inquiry, contact: number, comment: "Hello" },
        "write",
        "2026-11-06",
      ),
      {},
    );
  }
  for (const number of [
    "+1 234 567 8901",
    "+44 20 7946 0958",
    "020 7946 0958",
    "06 12 34 56 78",
    "(030) 123-4567",
  ])
    assert.deepEqual(
      validateInquiry({ ...inquiry, contact: number }, "gift", "2026-11-06"),
      {},
    );
  for (const number of ["+380", "0123", "++48 512345678", "380981112233 x1"])
    assert.equal(
      validateInquiry({ ...inquiry, contact: number }, "gift", "2026-11-06")
        .contact,
      "phone",
    );
});

test("a flooding client is turned away before the body is read, and a real one is not", () => {
  const { clientAddress, spendRequest, resetRequestBudgets } = serverModule<
    typeof import("../../src/lib/server/rate-limit.ts")
  >("src/lib/server/rate-limit.ts", {});
  const budget = { limit: 3, windowMs: 60_000 };
  const headers = (value?: string) =>
    new Request("https://caviar.net.ua/api/newsletter", {
      headers: value ? { "x-forwarded-for": value } : {},
    });

  // Vercel puts the client first; proxies append their own hops after it.
  assert.equal(
    clientAddress(headers("203.0.113.7, 70.41.3.18")),
    "203.0.113.7",
  );
  assert.equal(clientAddress(headers("  198.51.100.2  ")), "198.51.100.2");
  // No attributable address must share one bucket, never escape the limit.
  assert.equal(clientAddress(headers()), "unattributed");

  resetRequestBudgets();
  // Inside the budget nothing is refused.
  for (let i = 0; i < 3; i++)
    assert.equal(spendRequest("scope:a", budget), null, `request ${i + 1}`);
  // Over it, the caller is told how long to wait.
  const wait = spendRequest("scope:a", budget);
  assert.ok(
    typeof wait === "number" && wait >= 1 && wait <= 60,
    `wait=${wait}`,
  );

  // One client's flood must not spend another client's budget.
  assert.equal(spendRequest("scope:b", budget), null);
  // Nor must one endpoint's flood close a different endpoint.
  assert.equal(spendRequest("other:a", budget), null);

  // The window rolls: an expired bucket starts the client over.
  resetRequestBudgets();
  const past = { limit: 1, windowMs: 1 };
  assert.equal(spendRequest("scope:c", past), null);
  const after = Date.now() + 5;
  while (Date.now() < after);
  assert.equal(
    spendRequest("scope:c", past),
    null,
    "window should have rolled",
  );
  resetRequestBudgets();
});
