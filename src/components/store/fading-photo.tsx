"use client";

import { useState, type ComponentProps } from "react";
import { Photo } from "@/components/ui/photo";
import { useTranslator } from "@/i18n/client";

export function FadingPhoto({
  src,
  alt,
  className,
  replaceOnLoad = false,
  ...props
}: ComponentProps<typeof Photo> & { replaceOnLoad?: boolean }) {
  const t = useTranslator();
  const [shown, setShown] = useState({ src, alt });
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const pending = shown.src !== src;
  const shownClass =
    failed === shown.src
      ? "opacity-0"
      : replaceOnLoad && loaded === shown.src
        ? "photo-replace"
        : "";

  return (
    <div className="photo-stack">
      <Photo
        {...props}
        key={shown.src}
        src={shown.src}
        alt={pending ? shown.alt : alt}
        className={`${className ?? ""} ${shownClass}`}
        onError={() => setFailed(shown.src)}
      />
      {pending && (
        <Photo
          {...props}
          key={src}
          src={src}
          alt=""
          className={loaded === src ? "photo-enter" : "opacity-0"}
          onLoad={() => {
            setFailed(null);
            setLoaded(src);
            if (replaceOnLoad) setShown({ src, alt });
          }}
          onError={() => {
            setLoaded(null);
            setFailed(src);
          }}
          onAnimationEnd={() => {
            setShown({ src, alt });
            setLoaded(null);
          }}
        />
      )}
      {failed === src && (
        <p className="photo-unavailable" role="status">
          {t("photo.unavailable")}
        </p>
      )}
    </div>
  );
}
