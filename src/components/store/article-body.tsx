import type { JournalBlock } from "@/content/journal";
import type { Translator } from "@/i18n";

/**
 * Renders an article's blocks with whichever translator the caller has — the
 * client one inside the on-page reader, the server one on the article's own
 * page. The markup is identical in both, so the reader looks unchanged.
 */
export function ArticleBody({
  blocks,
  t,
}: {
  blocks: readonly JournalBlock[];
  t: Translator;
}) {
  return (
    <>
      {blocks.map(({ kind, key }) =>
        kind === "h" ? <h4 key={key}>{t(key)}</h4> : <p key={key}>{t(key)}</p>,
      )}
    </>
  );
}
