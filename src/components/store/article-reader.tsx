"use client";
import { StorefrontLink } from "./storefront-link";
import { useLocale, useTranslator } from "@/i18n/client";
import { ui } from "@/components/ui/styles";
import { Photo, photoDimensions } from "@/components/ui/photo";
import { getImageProps } from "next/image";
import { postsFor } from "@/lib/storefront-copy";
import { journalByPost } from "@/content/journal";
import { ArticleBody } from "./article-body";
function ArticlePortraitPhoto({
  alt,
  desktopSrc,
  mobileSrc,
}: {
  alt: string;
  desktopSrc: string;
  mobileSrc: string;
}) {
  const sizes = "(max-width: 640px) 100vw, 40vw";
  const {
    props: { srcSet: desktop },
  } = getImageProps({
    src: desktopSrc,
    alt,
    ...photoDimensions(desktopSrc),
    sizes,
    quality: 90,
  });
  const { props: mobile } = getImageProps({
    src: mobileSrc,
    alt,
    ...photoDimensions(mobileSrc),
    sizes,
  });

  return (
    <picture className="ph-b ph-img">
      <source media="(min-width: 641px)" srcSet={desktop} sizes={sizes} />
      <img
        {...mobile}
        alt={alt}
        className="store-photo"
        onLoad={(event) => {
          event.currentTarget.setAttribute("data-photo-ready", "");
        }}
        onError={(event) => {
          event.currentTarget.setAttribute("data-photo-ready", "");
        }}
      />
    </picture>
  );
}

function ArticlePhoto({
  index,
  showCaption = false,
}: {
  index: number;
  showCaption?: boolean;
}) {
  const post = postsFor(useLocale())[index]!;
  if (showCaption && (index === 0 || index === 2)) {
    return (
      <ArticlePortraitPhoto
        alt={post.ph}
        desktopSrc={
          index === 0
            ? "/assets/img/editorial/journal/caviar-serving-portrait.webp"
            : "/assets/img/editorial/journal/sturgeon-article.webp"
        }
        mobileSrc={post.image!}
      />
    );
  }
  const src = post.image;
  return src ? (
    <span className="ph-b ph-img">
      <Photo
        src={src}
        alt={post.ph}
        sizes={showCaption ? "(max-width:640px) 100vw, 40vw" : "72px"}
      />
    </span>
  ) : (
    <figure className="ph dark ph-b">
      <div className="ph-in" />
      {showCaption && <figcaption>{post.ph}</figcaption>}
    </figure>
  );
}
export function ArticleReader({
  index,
  onSelect,
  onClose,
}: {
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslator();
  const posts = postsFor(useLocale());
  const post = posts[index];
  const article = journalByPost(index);
  if (!post || !article) return null;
  return (
    <article className="relative min-h-full grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start max-[640px]:grid-cols-1">
      <div
        data-article-media
        className="sticky top-0 h-[var(--rd-h)] overflow-hidden bg-[#1a1a1a] max-[640px]:relative max-[640px]:aspect-[4/3] max-[640px]:h-auto"
      >
        <ArticlePhoto index={index} showCaption />
      </div>
      <div
        data-article-copy
        className="grid justify-items-start gap-5 px-[clamp(24px,4vw,64px)] pt-[clamp(40px,5vw,64px)] pb-[clamp(32px,4vw,48px)] max-[640px]:gap-4 max-[640px]:px-4 max-[640px]:pt-6"
      >
        <p className={`${ui.bLabel} text-[var(--b-gold-d)]`}>
          {t("article.category")}
        </p>
        <h2 className="max-[640px]:pr-0 pr-8 text-[clamp(30px,3vw,44px)] leading-[1.12] font-normal text-balance [font-family:var(--b-cond)]">
          {post.t}
        </h2>
        <div className="rd-txt grid max-w-[62ch] gap-3.5 text-base leading-[1.65] font-normal max-[640px]:text-[17px]">
          <ArticleBody blocks={article.blocks} t={t} />
        </div>
        <StorefrontLink
          className={`b-btn ${ui.bBtn} mt-2 max-[640px]:w-full`}
          section={post.btn[1]!.slice(1)}
          beforeNavigate={onClose}
        >
          {post.btn[0]}
        </StorefrontLink>
        <nav
          className="mt-5 grid w-full gap-3 [border-top:1px_dotted_var(--b-dot)] pt-6"
          aria-label={t("article.relatedLabel")}
        >
          <p className={`${ui.bLabel} text-[var(--b-mute)]`}>
            {t("article.related")}
          </p>
          <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
            {posts.map((other, i) =>
              i === index ? null : (
                <button
                  key={i}
                  className="grid min-h-[72px] grid-cols-[72px_1fr] items-center gap-3.5 text-left hover:underline underline-offset-4"
                  onClick={() => onSelect(i)}
                >
                  <span className="relative size-[72px] overflow-hidden">
                    <ArticlePhoto index={i} />
                  </span>
                  <span className="text-lg leading-[1.2] [font-family:var(--b-cond)]">
                    {other.t}
                  </span>
                </button>
              ),
            )}
          </div>
        </nav>
      </div>
    </article>
  );
}
