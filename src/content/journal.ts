import type { MessageKey } from "@/i18n/index";

/**
 * The three editorial articles. They live here rather than in three components
 * so the same ordered blocks render both inside the on-page reader and on the
 * article's own address — previously the text existed only in a client overlay
 * and so did not exist for search engines at all.
 *
 * Slugs are identical in both locales so `hreflang` can pair the pages.
 */
export type JournalBlock = { kind: "h" | "p"; key: MessageKey };

export type JournalArticle = {
  slug: string;
  /** Index in `posts.json`, which carries the card title and photograph. */
  post: 0 | 1 | 2;
  titleKey: MessageKey;
  image: string;
  altKey: MessageKey;
  blocks: JournalBlock[];
};

const paragraphs = (keys: MessageKey[]): JournalBlock[] =>
  keys.map((key) => ({ kind: "p", key }));

export const journal: JournalArticle[] = [
  {
    slug: "serving-caviar",
    post: 0,
    titleKey: "blog.text2",
    image: "/assets/img/editorial/journal/caviar-serving-card.webp",
    altKey: "blog.alt1",
    blocks: paragraphs([
      "article-0.paragraph1",
      "article-0.paragraph2",
      "article-0.paragraph3",
      "article-0.paragraph4",
    ]),
  },
  {
    slug: "packing-and-delivery",
    post: 1,
    titleKey: "blog.text4",
    image: "/assets/img/editorial/journal/blog-jar.jpg",
    altKey: "blog.alt2",
    blocks: paragraphs([
      "article-1.paragraph1",
      "article-1.paragraph2",
      "article-1.paragraph3",
    ]),
  },
  {
    slug: "sturgeon-species",
    post: 2,
    titleKey: "blog.text6",
    image: "/assets/img/editorial/journal/sturgeon-species.webp",
    altKey: "blog.alt3",
    blocks: [
      { kind: "h", key: "article-2.heading1" },
      { kind: "p", key: "article-2.paragraph1" },
      { kind: "h", key: "article-2.heading2" },
      { kind: "p", key: "article-2.paragraph2" },
      { kind: "h", key: "article-2.heading3" },
      { kind: "p", key: "article-2.paragraph3" },
    ],
  },
];

export const journalArticle = (slug: string) =>
  journal.find((article) => article.slug === slug);

/**
 * The block a meta description is built from: the first paragraph, never a
 * heading. `sturgeon-species` opens with one, and taking `blocks[0]` shipped a
 * description of a single species name ("Осетер") in both locales.
 */
export const journalSummaryKey = (article: JournalArticle) =>
  (article.blocks.find(({ kind }) => kind === "p") ?? article.blocks[0]!).key;

export const journalByPost = (post: number) =>
  journal.find((article) => article.post === post);
