import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { serverModule } from "../helpers/server-module.ts";
import type { Product } from "../../src/domain/catalog.ts";

const origin = "https://caviar.net.ua";
const productionSite = {
  site: { production: true, url: new URL(`${origin}/`) },
  pageMetadata: () => ({}),
  socialPreview: () => ({}),
};

const catalogue = [
  {
    id: "sterlet",
    slug: "sterlet",
    name: "Ікра стерляді",
    description: "Ніжна ікра стерляді.",
    servingImage: "/assets/img/serve-premium.jpg",
    variants: [
      { id: "s-50", weightGrams: 50, priceMinor: 150000, available: true },
      { id: "s-100", weightGrams: 100, priceMinor: 280000, available: true },
    ],
  },
] as unknown as Product[];

function routes(products: Product[] = catalogue) {
  const mocks = {
    [resolve("src/lib/metadata.ts")]: productionSite,
    [resolve("src/lib/server/catalog/storefront.ts")]: {
      storefrontCaviar: async () => products,
    },
  };
  return {
    robots: serverModule<typeof import("../../src/app/robots.ts")>(
      "src/app/robots.ts",
      mocks,
    ),
    sitemap: serverModule<typeof import("../../src/app/sitemap.ts")>(
      "src/app/sitemap.ts",
      mocks,
    ),
    llms: serverModule<typeof import("../../src/app/llms.txt/route.ts")>(
      "src/app/llms.txt/route.ts",
      mocks,
    ),
  };
}

test("robots names the assistants that cite sources and keeps staff paths closed", () => {
  const rules = routes().robots.default().rules;
  assert.ok(Array.isArray(rules));
  const agents = rules.flatMap((rule) =>
    [rule.userAgent].flat().filter((value): value is string => Boolean(value)),
  );
  // Training and search are separate products; each needs its own directive.
  for (const bot of [
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
  ])
    assert.ok(agents.includes(bot), `missing directive for ${bot}`);
  // Yandex is shut out entirely; the wildcard would otherwise admit it.
  assert.deepEqual(
    rules.find((rule) => rule.userAgent === "Yandex"),
    { userAgent: "Yandex", disallow: "/" },
  );
  assert.ok(!agents.includes("YandexBot"));
  for (const rule of rules.filter((rule) => rule.userAgent !== "Yandex")) {
    assert.equal(rule.allow, "/");
    assert.deepEqual(rule.disallow, ["/api/", "/admin/", "/sign-in"]);
  }
});

test("preview deployments stay closed and publish no map at all", () => {
  const preview = {
    [resolve("src/lib/metadata.ts")]: {
      site: { production: false, url: new URL("https://preview.invalid/") },
    },
    [resolve("src/lib/server/catalog/storefront.ts")]: {
      storefrontCaviar: async () => catalogue,
    },
  };
  const robots = serverModule<typeof import("../../src/app/robots.ts")>(
    "src/app/robots.ts",
    preview,
  ).default();
  assert.deepEqual(robots.rules, { userAgent: "*", disallow: "/" });
  assert.equal(robots.sitemap, undefined);
});

test("the sitemap carries dates, language pairs and images, and never a hidden product", async () => {
  const entries = await routes().sitemap.default();
  const urls = entries.map((entry) => entry.url);
  assert.ok(urls.includes(`${origin}/ua`));
  assert.ok(urls.includes(`${origin}/en`));
  assert.ok(urls.includes(`${origin}/ua/products/sterlet`));
  assert.ok(urls.includes(`${origin}/ua/journal/serving-caviar`));
  assert.ok(urls.includes(`${origin}/ua/offer`));
  // The catalogue query filters unpublished, archived and the test product; the
  // sitemap must take its list from there and add nothing of its own.
  assert.ok(!urls.some((url) => url.includes("checkout-test")));
  for (const entry of entries) {
    assert.ok(entry.lastModified instanceof Date);
    assert.equal(
      entry.alternates?.languages?.uk,
      entry.url.replace("/en", "/ua"),
    );
    assert.ok(!entry.url.includes("?"));
  }
  const product = entries.find(
    (entry) => entry.url === `${origin}/ua/products/sterlet`,
  )!;
  assert.deepEqual(product.images, [`${origin}/assets/img/serve-premium.jpg`]);
});

test("llms.txt is generated from the live catalogue, with prices as plain text", async () => {
  const response = await routes().llms.GET();
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /text\/plain; charset=utf-8/,
  );
  const body = await response.text();
  // Facts an assistant needs to answer "where to buy caviar in Ukraine".
  assert.match(body, /Ікра стерляді/);
  // uk-UA groups thousands with a non-breaking space.
  assert.match(body, /50 г — 1\s500 грн/);
  assert.match(body, /100 г — 2\s800 грн/);
  assert.match(body, /Нова пошта/);
  assert.match(body, /Plata by mono/);
  assert.match(body, /sale@caviar\.net\.ua/);
  assert.match(body, new RegExp(`${origin}/ua/products/sterlet`));
  assert.match(body, new RegExp(`${origin}/ua/journal/serving-caviar`));

  // Nothing is advertised that the catalogue no longer sells.
  const empty = await routes([]).llms.GET();
  const emptyBody = await empty.text();
  assert.ok(!emptyBody.includes("Ікра стерляді"));
});

test("a preview deployment publishes no llms.txt", async () => {
  const response = await serverModule<
    typeof import("../../src/app/llms.txt/route.ts")
  >("src/app/llms.txt/route.ts", {
    [resolve("src/lib/metadata.ts")]: {
      site: { production: false, url: new URL("https://preview.invalid/") },
    },
    [resolve("src/lib/server/catalog/storefront.ts")]: {
      storefrontCaviar: async () => catalogue,
    },
  }).GET();
  assert.equal(response.status, 404);
});

test("every journal article describes itself with a sentence, not its heading", () => {
  // `sturgeon-species` opens with a heading, so taking `blocks[0]` shipped a
  // two-word description ("Осетер" / "Russian Sturgeon") to both the meta tag
  // and the Article JSON-LD. Both now read the first paragraph.
  const { journal, journalSummaryKey } = serverModule<
    typeof import("../../src/content/journal.ts")
  >("src/content/journal.ts", {});
  const { getTranslator } = serverModule<
    typeof import("../../src/i18n/index.ts")
  >("src/i18n/index.ts", {});
  for (const locale of ["ua", "en"] as const) {
    const t = getTranslator(locale);
    for (const article of journal) {
      const key = journalSummaryKey(article);
      const summary = t(key);
      const block = article.blocks.find((item) => item.key === key);
      assert.equal(
        block?.kind,
        "p",
        `${article.slug} (${locale}) summarises a ${block?.kind} block`,
      );
      assert.ok(
        summary.length >= 80,
        `${article.slug} (${locale}) description is ${summary.length} characters: "${summary}"`,
      );
      // A description that merely repeats the headline tells a reader nothing.
      assert.notEqual(summary.trim(), t(article.titleKey).trim());
      assert.ok(
        !summary.includes("{"),
        `${article.slug} (${locale}) description carries an unreplaced placeholder`,
      );
    }
  }
});

test("every old address Search still holds lands on its real equivalent", async () => {
  // A rule that drifts from this table throws away a ranking page; a rule that
  // shadows a live path breaks the storefront.
  const { default: config } = await import("../../next.config.ts");
  const rules = (await config.redirects!()) as {
    source: string;
    destination: string;
    permanent: boolean;
  }[];
  const resolve = (path: string) => {
    for (const rule of rules) {
      if (rule.source === path) return rule.destination;
      const blanket = /^\/:locale\(uk\|ru\)(\/:path\*)?$/.exec(rule.source);
      if (blanket) {
        const segments = path.split("/").filter(Boolean);
        if (
          ["uk", "ru"].includes(segments[0] ?? "") &&
          (blanket[1] ? segments.length > 1 : segments.length === 1)
        )
          return rule.destination;
      }
    }
    return null;
  };

  for (const [from, to] of [
    ["/uk/vidi-rib", "/ua/journal/sturgeon-species"],
    ["/ru/vidy-ryby", "/ua/journal/sturgeon-species"],
    ["/en/types-of-fish-2", "/en/journal/sturgeon-species"],
    ["/uk/pro-nas", "/ua#about"],
    ["/en/about-us", "/en#about"],
    ["/ru/kontakty", "/ua#contacts"],
    ["/en/products", "/en#ikra"],
    ["/uk/produktsiya/ikra-bestera", "/ua/products/hybrid"],
    ["/en/products/caviar-of-bester", "/en/products/hybrid"],
    ["/en/products/caviar-of-russian-sturgeon", "/en/products/premium"],
    // Published in the home page's blog archive.
    ["/ru/azovskij-osetr-vozvrashhaetsya-domoj", "/ua#blog"],
    ["/en/azov-sturgeon-return-home", "/en#blog"],
    // Everything else still arrives somewhere.
    ["/uk/anything-we-never-listed", "/ua"],
    ["/ru", "/ua"],
  ] as const)
    assert.equal(resolve(from), to, from);

  // A pattern under `/en` would redirect the live storefront over itself.
  for (const rule of rules)
    if (rule.source.startsWith("/en"))
      assert.doesNotMatch(
        rule.source,
        /[:*]/,
        `an English rule may not be a pattern: ${rule.source}`,
      );
  assert.equal(resolve("/en/never-existed"), null);

  // No rule may send traffic to a path another rule takes away.
  const destinations = new Set(
    rules.map((rule) => rule.destination.split("#")[0]),
  );
  for (const rule of rules)
    assert.ok(
      !destinations.has(rule.source),
      `${rule.source} is both a redirect source and a destination`,
    );

  for (const rule of rules) {
    assert.equal(rule.permanent, true, rule.source);
    if (rule.source.startsWith("/en/"))
      assert.ok(rule.destination.startsWith("/en"), rule.source);
  }
  // The catch-alls stay last, or they swallow the named pages.
  assert.deepEqual(
    rules.slice(-2).map((rule) => rule.source),
    ["/:locale(uk|ru)", "/:locale(uk|ru)/:path*"],
  );
});
