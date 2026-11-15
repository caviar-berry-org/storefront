"use client";

import Image from "next/image";
import dimensions from "@/content/image-sizes.json";
import bundledCatalogMedia from "@/content/bundled-catalog-media.json";
import catalogMedia from "@/content/catalog-media.json";
import type { ComponentProps, CSSProperties } from "react";

interface PhotoProps extends Pick<
  ComponentProps<typeof Image>,
  "onLoad" | "onError" | "onAnimationEnd" | "draggable" | "unoptimized"
> {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  loading?: "lazy" | "eager";
}
function bundledSource(src: string) {
  const id =
    /^https:\/\/res\.cloudinary\.com\/[a-z0-9-]+\/image\/upload\/v\d+\/catalog\/([a-f0-9]{64})\.webp(?:#\d{1,4}x\d{1,4})?$/.exec(
      src,
    )?.[1];
  return id
    ? (bundledCatalogMedia[id as keyof typeof bundledCatalogMedia] ?? src)
    : src;
}

export function photoDimensions(source: string) {
  const src = bundledSource(source);
  const size = src.startsWith("https://res.cloudinary.com/")
    ? /#(\d{1,4})x(\d{1,4})$/.exec(src)
    : null;
  if (size) return { width: Number(size[1]), height: Number(size[2]) };
  return (
    dimensions[src as keyof typeof dimensions] ?? {
      width: 1200,
      height: 800,
    }
  );
}

type PreEncoded = {
  width: number;
  height: number;
  srcSet: string;
  fallback: string;
};

export function Photo({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 50vw",
  className,
  onLoad,
  onError,
  ...rest
}: PhotoProps) {
  const resolved = bundledSource(src).split("#")[0]!;
  const mark = (event: { currentTarget: HTMLImageElement }) =>
    event.currentTarget.setAttribute("data-photo-ready", "");
  const classes = `store-photo${className ? ` ${className}` : ""}`;

  const fixed = catalogMedia[resolved as keyof typeof catalogMedia] as
    PreEncoded | undefined;
  if (fixed) {
    const { quality: _q, unoptimized: _u, loading, ...img } = rest;
    void _q;
    void _u;
    // Straight from `public/`, past the optimizer: already encoded at the
    // measured quality, so a per-request transform only adds latency.
    return (
      <img
        {...img}
        ref={(node) => {
          // A cached image can finish before hydration attaches onLoad.
          if (node?.complete) node.setAttribute("data-photo-ready", "");
        }}
        className={classes}
        src={fixed.fallback}
        srcSet={fixed.srcSet}
        sizes={sizes}
        width={fixed.width}
        height={fixed.height}
        alt={alt}
        loading={priority ? "eager" : (loading ?? "lazy")}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={(event) => {
          mark(event);
          onLoad?.(event as never);
        }}
        onError={(event) => {
          mark(event);
          onError?.(event as never);
        }}
      />
    );
  }

  return (
    <Image
      key={src}
      className={classes}
      src={resolved}
      alt={alt}
      {...photoDimensions(src)}
      sizes={sizes}
      priority={priority}
      {...rest}
      onLoad={(event) => {
        mark(event);
        onLoad?.(event);
      }}
      onError={(event) => {
        mark(event);
        onError?.(event);
      }}
    />
  );
}
