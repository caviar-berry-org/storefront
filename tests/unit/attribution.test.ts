import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAttribution,
  readAttribution,
  serializeAttribution,
  utmLink,
  utmSources,
} from "../../src/domain/attribution.ts";

const at = Date.UTC(2026, 10, 13);

test("a landing query becomes a known channel, and anything else becomes other", () => {
  assert.deepEqual(
    parseAttribution(
      "?utm_source=instagram&utm_medium=social&utm_campaign=Autumn-2026",
      at,
    ),
    {
      source: "instagram",
      medium: "social",
      campaign: "autumn-2026",
      firstSeenAt: at,
    },
  );
  // Platform spellings map onto our own names so one channel is not split in two.
  for (const [query, source] of [
    ["?utm_source=IG", "instagram"],
    ["?utm_source=l.instagram.com", "instagram"],
    ["?utm_source=chatgpt.com", "chatgpt"],
    ["?utm_source=chat.openai.com", "chatgpt"],
    ["?utm_source=t.me", "telegram"],
    ["?ref=facebook", "facebook"],
  ] as const)
    assert.equal(parseAttribution(query, at)?.source, source, query);
  // An unknown value is counted, never stored verbatim.
  assert.equal(
    parseAttribution("?utm_source=some-random-partner", at)?.source,
    "other",
  );
  // Nothing to attribute.
  assert.equal(parseAttribution("", at), null);
  assert.equal(parseAttribution("?q=caviar", at), null);
});

test("a visitor cannot smuggle anything through the attribution cookie", () => {
  const value = serializeAttribution({
    source: "instagram",
    medium: "social",
    campaign: "autumn-2026",
    firstSeenAt: at,
  });
  assert.deepEqual(readAttribution(value), {
    source: "instagram",
    medium: "social",
    campaign: "autumn-2026",
    firstSeenAt: at,
  });

  // The value reaches a Firestore document and a staff screen, so a cookie that
  // is not one of ours yields nothing at all.
  for (const hostile of [
    "s=<script>&t=1",
    "s=instagram'--&t=1",
    "s=INSTAGRAM&t=1",
    "s=unknown-network&t=1",
    "s=instagram&t=0",
    "s=instagram&t=not-a-number",
    "s=instagram",
    "",
    undefined,
    null,
    "x".repeat(200),
  ])
    assert.equal(readAttribution(hostile), null, String(hostile));

  // A valid channel with an unusable campaign keeps the channel and drops the
  // campaign: losing the whole attribution would be the worse trade.
  const injected = readAttribution(`s=instagram&t=${at}&c=<img src=x>`);
  assert.equal(injected?.source, "instagram");
  assert.equal(injected?.campaign, undefined);

  // An over-long campaign is truncated to the stored limit, never rejected.
  const long = readAttribution(`s=instagram&t=${at}&c=${"x".repeat(60)}`);
  assert.equal(long?.campaign, "x".repeat(40));
});

test("copied links carry the channel and nothing else", () => {
  const origin = "https://caviar.net.ua";
  for (const source of utmSources) {
    const link = new URL(utmLink(origin, "/ua#ikra", source));
    assert.equal(link.origin, origin);
    assert.equal(link.pathname, "/ua");
    assert.equal(link.hash, "#ikra");
    assert.equal(link.searchParams.get("utm_source"), source);
    assert.equal(link.searchParams.get("utm_campaign"), null);
  }
  const campaign = new URL(
    utmLink(origin, "/ua", "instagram", {
      campaign: "autumn-2026",
      medium: "social",
    }),
  );
  assert.equal(campaign.searchParams.get("utm_campaign"), "autumn-2026");
  assert.equal(campaign.searchParams.get("utm_medium"), "social");
  // Round trip: a link we generate is a link we can read back.
  assert.equal(parseAttribution(campaign.search, at)?.campaign, "autumn-2026");
});
