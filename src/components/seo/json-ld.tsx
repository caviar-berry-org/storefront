import { schemaGraph, type Schema } from "@/domain/structured-data";

/**
 * Emits the page's schema.org graph. Rendered on the server inside statically
 * generated pages, so it costs nothing at request time.
 *
 * The JSON is injected as a script body rather than text content so that
 * `</script>` inside a catalogue description cannot close the tag early.
 */
export function JsonLd({ items }: { items: readonly Schema[] }) {
  if (!items.length) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: schemaGraph(items).replace(/</g, "\\u003c"),
      }}
    />
  );
}
