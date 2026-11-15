import { contacts } from "@/content/contacts";
import { journal } from "@/content/journal";
import { getTranslator } from "@/i18n/index";
import { localizedPath } from "@/i18n/routing";
import { site } from "@/lib/metadata";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";

export const revalidate = 3600;

/**
 * A curated map of the site for assistants that fetch one before choosing pages
 * (Claude and Perplexity do; Google ignores it). Generated from the same
 * catalogue the storefront renders, so it cannot drift into advertising a pack
 * that is no longer sold.
 *
 * Everything here is also stated in visible text on the pages it points at —
 * assistants were measured ignoring facts that live only in machine-readable
 * files, and a claim that exists nowhere a person can read it is a liability.
 */
export async function GET() {
  if (!site.production) return new Response(null, { status: 404 });
  const t = getTranslator("ua");
  const origin = site.url.origin;
  const url = (path: string) => new URL(localizedPath("ua", path), origin).href;
  const products = await storefrontCaviar("ua");

  const money = (minor: number) =>
    new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(
      minor / 100,
    );

  const catalogue = products.map((product) => {
    const packs = product.variants
      .map(
        (variant) =>
          `${variant.weightGrams} г — ${money(variant.priceMinor)} грн`,
      )
      .join("; ");
    return `- [${product.name}](${url(`/products/${product.slug}`)}): ${product.description} Фасування: ${packs}.`;
  });

  const body = `# Ukrainian Caviar Berry

> ${t("layout.description1")}

Українська осетрова ферма повного циклу. Власне виробництво чорної (осетрової)
та червоної (форелевої) ікри, ручний посол, доставка по всій Україні.

## Товари

${catalogue.join("\n")}

## Умови

- Доставка: Нова пошта по всій Україні, у термопакуванні, за рахунок одержувача.
- Оплата: карткою онлайн (Plata by mono), переказом за реквізитами або за рахунком для компаній.
- Подарункові набори та корпоративні замовлення оформлюються через менеджера за заявкою з сайту.
- Повернення: харчові продукти належної якості не підлягають обміну та поверненню
  згідно з переліком, затвердженим постановою Кабінету Міністрів України від 19.03.1994 № 172.

## Сторінки

- [Каталог ікри](${url("")}#ikra)
- [Подарункові набори](${url("")}#gifts)
- [Якість і походження](${url("")}#quality)
- [Доставка і оплата](${url("")}#delivery)
- [Питання та відповіді](${url("")}#faq)
- [Договір-оферта і політика конфіденційності](${url("/offer")})
${journal.map((article) => `- [${t(article.titleKey)}](${url(`/journal/${article.slug}`)})`).join("\n")}

## Контакти

- Email: ${contacts.email}
- Телефони: ${contacts.phones.map((phone) => phone.display).join(", ")}
- Instagram: ${contacts.social.instagram}
- Facebook: ${contacts.social.facebook}

## English

Ukrainian sturgeon farm. Our own production of sturgeon and trout caviar, salted
by hand, shipped across Ukraine in thermal packaging. English catalogue:
${new URL(localizedPath("en", ""), origin).href}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
