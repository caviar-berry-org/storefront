"use client";

import { preload } from "react-dom";
import media from "@/content/editorial-media.json";

export type EditorialName = keyof typeof media;

interface Source {
  /** `<source media>`; absent on the widest (fallback) variant. */
  media?: string;
  sizes: string;
  /** MIME type to pre-encoded `srcset`, in preference order. */
  sources: Record<string, string>;
}

interface EditorialPhotoProps {
  name: EditorialName;
  alt: string;
  /** Frame classes applied to `<picture>`; it replaces the usual figure. */
  className?: string;
  imageClassName?: string;
  /** Eager-loads and head-preloads the ladder; use only for the LCP photo. */
  priority?: boolean;
  /** Finished art-directed files that have no original to rebuild from. */
  extraSources?: Source[];
}

/**
 * Preload conditions must not overlap, or phones fetch the desktop ladder too.
 * Every art-directed condition here is `(max-width: Npx)`, so the widest
 * variant covers everything above the largest of them.
 */
function widestCondition(sources: Source[]) {
  const breakpoints = sources.flatMap((source) =>
    source.media
      ? [Number(/max-width:\s*(\d+)px/.exec(source.media)?.[1] ?? 0)]
      : [],
  );
  return breakpoints.length
    ? `(min-width: ${Math.max(...breakpoints) + 1}px)`
    : undefined;
}

/**
 * Renders a pre-encoded AVIF/WebP ladder straight from `public/assets`.
 * Unlike `Photo` these files skip the Next.js image optimizer: they are already
 * encoded once at the calibrated quality, and a second pass visibly flattens
 * the fine texture these photos exist to show.
 */
export function EditorialPhoto({
  name,
  alt,
  className,
  imageClassName,
  priority = false,
  extraSources = [],
}: EditorialPhotoProps) {
  const entry = media[name];
  const sources: Source[] = [...extraSources, ...(entry.variants as Source[])];
  const base = sources.at(-1)!;
  const baseWebp = base.sources["image/webp"]!;
  if (priority) {
    const fallbackCondition = widestCondition(sources);
    for (const source of sources) {
      // Only the preferred format: `type` filters out browsers that cannot
      // decode it, while preloading every format would fetch them all.
      const [type, srcSet] = Object.entries(source.sources)[0]!;
      // Hoisted into <head>, ahead of the markup the preload scanner reaches.
      preload(srcSet.split(" ")[0]!, {
        as: "image",
        type,
        media: source.media ?? fallbackCondition,
        imageSrcSet: srcSet,
        imageSizes: source.sizes,
        fetchPriority: "high",
      });
    }
  }
  return (
    <picture className={className}>
      {sources.flatMap((source) =>
        Object.entries(source.sources).map(([type, srcSet]) =>
          // The <img> already carries the widest WebP ladder.
          srcSet === baseWebp ? null : (
            <source
              key={`${source.media ?? "base"}-${type}`}
              {...(source.media ? { media: source.media } : {})}
              type={type}
              srcSet={srcSet}
              sizes={source.sizes}
            />
          ),
        ),
      )}
      <img
        ref={(node) => {
          // A cached image can finish before hydration attaches onLoad, and the
          // reveal styles keep it at opacity 0 until this attribute exists.
          if (node?.complete) node.setAttribute("data-photo-ready", "");
        }}
        className={`store-photo${imageClassName ? ` ${imageClassName}` : ""}`}
        src={entry.fallback}
        srcSet={baseWebp}
        sizes={base.sizes}
        width={entry.width}
        height={entry.height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={(event) =>
          event.currentTarget.setAttribute("data-photo-ready", "")
        }
        onError={(event) =>
          event.currentTarget.setAttribute("data-photo-ready", "")
        }
      />
    </picture>
  );
}
