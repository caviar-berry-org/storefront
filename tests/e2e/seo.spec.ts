import { expect, test } from "@playwright/test";

/**
 * Assistants were measured ignoring facts that live only in machine-readable
 * markup, so the facts a person could answer "where do I buy caviar in Ukraine"
 * with must exist in the server HTML. These assertions read the raw response,
 * exactly as a crawler does — no JavaScript runs.
 */
const facts = {
  ua: ["Нова пошта", "грн", "Україн", "ікр"],
  en: ["Nova Poshta", "Ukrain", "caviar"],
} as const;

for (const locale of ["ua", "en"] as const) {
  test(`the ${locale} home page states its commerce facts in server HTML`, async ({
    request,
  }) => {
    const response = await request.get(`/${locale}`);
    expect(response.status()).toBe(200);
    const html = await response.text();

    for (const fact of facts[locale]) expect(html).toContain(fact);
    // A price and a pack weight, not only a product name.
    expect(html).toMatch(/\d+\s*(г|g)\b/);
    // Contact details a person can act on.
    expect(html).toContain("sale@caviar.net.ua");
    // One schema.org graph that parses, with the page's own types.
    const graphs = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ];
    expect(graphs).toHaveLength(1);
    const graph = JSON.parse(graphs[0]![1]!.replace(/\\u003c/g, "<")) as {
      "@graph": { "@type": string }[];
    };
    const types = graph["@graph"].map((item) => item["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(types).toContain("FAQPage");
  });
}

test("each article is reachable by its own address and carries its full text", async ({
  request,
}) => {
  const home = await (await request.get("/ua")).text();
  // The card is a real link, not a button only JavaScript can open.
  const links = [...home.matchAll(/href="(\/ua\/journal\/[a-z-]+)"/g)].map(
    (match) => match[1]!,
  );
  expect(new Set(links).size).toBe(3);

  for (const path of new Set(links)) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    // Body copy, not just the headline that already existed on the card.
    const paragraphs = [...html.matchAll(/<p[^>]*>([^<]{120,})<\/p>/g)];
    expect(paragraphs.length, `${path} has no body copy`).toBeGreaterThan(0);
    const types = (
      JSON.parse(
        html
          .match(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
          )![1]!
          .replace(/\\u003c/g, "<"),
      ) as { "@graph": { "@type": string }[] }
    )["@graph"].map((item) => item["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("BreadcrumbList");
  }
});

test("a product page carries its offers and a canonical without query parameters", async ({
  request,
}) => {
  const home = await (await request.get("/ua")).text();
  const slug = home.match(/href="\/ua\/products\/([a-z0-9-]+)"/)?.[1];
  expect(slug, "no product link on the home page").toBeTruthy();
  const html = await (await request.get(`/ua/products/${slug}`)).text();

  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? "";
  expect(canonical).toContain(`/ua/products/${slug}`);
  expect(canonical).not.toContain("?");
  // HTML attributes are case-insensitive, and the dev server serialises hrefLang.
  expect(html).toMatch(/hreflang="x-default"/i);

  const graph = JSON.parse(
    html
      .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!
      .replace(/\\u003c/g, "<"),
  ) as { "@graph": Record<string, unknown>[] };
  const product = graph["@graph"].find((item) => item["@type"] === "Product");
  expect(product).toBeTruthy();
  const offers = JSON.stringify(product!.offers);
  expect(offers).toContain("UAH");
  expect(offers).toMatch(/InStock|OutOfStock/);
  // Never a shipping rate we do not charge.
  expect(offers).not.toContain("shippingDetails");
});

test("a preview deployment publishes no map, no llms.txt and no indexing", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /");
  expect(robots).not.toContain("Sitemap:");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("<loc>");
  expect((await request.get("/llms.txt")).status()).toBe(404);
});
