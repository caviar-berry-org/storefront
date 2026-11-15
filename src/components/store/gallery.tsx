"use client";
import { ui } from "@/components/ui/styles";
import { useTranslator } from "@/i18n/client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Photo, photoDimensions } from "@/components/ui/photo";
import { FadingPhoto } from "./fading-photo";
import { Lightbox } from "./lightbox";
export function Gallery({
  photos,
  weight,
  variantId,
  productId,
}: {
  photos: { src: string; alt: string }[];
  weight: number;
  variantId: string;
  productId: string;
}) {
  const t = useTranslator();
  const [selection, setSelection] = useState({ variantId, index: 0 });
  const selected = selection.variantId === variantId ? selection.index : 0;
  const [zoom, setZoom] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (matchMedia("(max-width:640px)").matches) {
      strip.current?.scrollTo({
        left: 0,
        behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [variantId]);
  return (
    <>
      <div
        className={`pp-thumbs sticky top-[64px] grid gap-[8px] max-[640px]:hidden`}
      >
        {photos.map((photo, index) => (
          <button
            className={`pp-th relative w-[72px] h-[72px] grid [place-items:center] p-[9px] [background:#fff] overflow-hidden [border:0] cursor-pointer [outline:1px_solid_transparent] [outline-offset:-1px] pp-th-ph`}
            key={index}
            aria-label={photo.alt}
            aria-pressed={selected === index}
            onClick={() => setSelection({ variantId, index })}
          >
            <span className={`ph-b ph-img${index === 1 ? " ph-food" : ""}`}>
              <Photo src={photo.src} alt="" sizes="72px" />
            </span>
          </button>
        ))}
      </div>
      <div
        ref={strip}
        className={`pp-gal grid gap-[16px] max-[640px]:flex max-[640px]:gap-[8px] max-[640px]:[overflow-x:auto] max-[640px]:[overflow-y:hidden] max-[640px]:[overscroll-behavior-x:contain] max-[640px]:[scroll-snap-type:x_mandatory] max-[640px]:[scrollbar-width:none] max-[640px]:[margin-inline:-16px] max-[640px]:[padding-inline:16px] max-[640px]:[scroll-padding-inline:16px]`}
      >
        {photos.map((photo, index) => {
          const { width, height } = photoDimensions(photo.src);
          return (
            <button
              type="button"
              className={`pp-photo${index === 0 ? " pp-pack" : ""}${index === selected ? " on" : ""}`}
              data-ppp={index === 0 ? productId : undefined}
              style={
                {
                  "--photo-ratio": `${width} / ${height}`,
                } as CSSProperties
              }
              key={index}
              onClick={() => setZoom(index)}
              aria-label={t("gallery.text1", { value1: photo.alt })}
            >
              <figure className={`ph-b ph-img${index === 1 ? " ph-food" : ""}`}>
                {index === 0 ? (
                  <FadingPhoto
                    src={photo.src}
                    alt={photo.alt}
                    quality={90}
                    sizes="(max-width: 640px) 86vw, 44vw"
                    priority
                  />
                ) : (
                  <Photo
                    src={photo.src}
                    alt={photo.alt}
                    quality={90}
                    sizes="(max-width: 640px) 86vw, 44vw"
                  />
                )}
              </figure>
              {index === 0 && (
                <span className={`pp-ptag b-label ${ui.bLabel}`}>
                  {weight}
                  {t("catalog.text5")}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {zoom !== null && (
        <Lightbox
          photos={photos}
          initial={zoom}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}
