import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/store/article-body";
import { JsonLd } from "@/components/seo/json-ld";
import { Photo } from "@/components/ui/photo";
import { StorefrontLink } from "@/components/store/storefront-link";
import { ui } from "@/components/ui/styles";
import { journal, journalArticle, journalSummaryKey } from "@/content/journal";
import { getTranslator } from "@/i18n";
import { isLocale, localizedPath, locales } from "@/i18n/routing";
import { PageVisit } from "@/components/ui/page-visit";
import { pageMetadata, site } from "@/lib/metadata";
import { identityGraph } from "@/lib/seo-graph";
import { postsFor } from "@/lib/storefront-copy";
import { articleSchema, breadcrumbSchema } from "@/domain/structured-data";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    journal.map((article) => ({ locale, slug: article.slug })),
  );
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const article = journalArticle(slug);
  if (!isLocale(locale) || !article) return {};
  const t = getTranslator(locale);
  const title = postsFor(locale)[article.post]?.t ?? t(article.titleKey);
  return pageMetadata(
    locale,
    title,
    t(journalSummaryKey(article)).slice(0, 300),
    `/journal/${article.slug}`,
  );
}

export default async function JournalPage({ params }: Props) {
  const { locale, slug } = await params;
  const article = journalArticle(slug);
  if (!isLocale(locale) || !article) notFound();
  const t = getTranslator(locale);
  const post = postsFor(locale)[article.post];
  const title = post?.t ?? t(article.titleKey);
  const path = `/journal/${article.slug}`;

  return (
    <main id="main-content" className="journal-page">
      <PageVisit />
      <JsonLd
        items={[
          ...identityGraph(locale, path),
          articleSchema({
            origin: site.url.origin,
            locale,
            path: localizedPath(locale, path),
            headline: title,
            description: t(journalSummaryKey(article)),
            image: article.image,
          }),
          breadcrumbSchema(site.url.origin, [
            { name: "Ukrainian Caviar Berry", path: localizedPath(locale, "") },
            {
              name: t("blog.heading1"),
              path: `${localizedPath(locale, "")}#blog`,
            },
            { name: title, path: localizedPath(locale, path) },
          ]),
        ]}
      />
      <article className="mx-auto max-w-3xl px-5 pt-36 pb-20">
        <p className={`${ui.bLabel} text-[var(--b-gold-d)]`}>
          {t("article.category")}
        </p>
        <h1 className="mt-3 text-[clamp(30px,3vw,44px)] leading-[1.12] font-normal text-balance [font-family:var(--b-cond)]">
          {title}
        </h1>
        <figure className="ph-b ph-img mt-7 overflow-hidden">
          <Photo src={article.image} alt={t(article.altKey)} />
        </figure>
        <div className="rd-txt mt-7 grid max-w-[62ch] gap-3.5 text-base leading-[1.65]">
          <ArticleBody blocks={article.blocks} t={t} />
        </div>
        <StorefrontLink
          className={`b-btn ${ui.bBtn} mt-9`}
          section={post?.btn[1]?.slice(1) ?? "ikra"}
        >
          {post?.btn[0] ?? t("blog.link2")}
        </StorefrontLink>
      </article>
    </main>
  );
}
