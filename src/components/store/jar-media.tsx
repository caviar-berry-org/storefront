"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function JarMedia({
  children,
  staticPhoto,
}: {
  children: ReactNode;
  staticPhoto?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function updateReady() {
    const jar = ref.current;
    if (!jar) return;
    const images = Array.from(jar.querySelectorAll("img"));
    jar.toggleAttribute(
      "data-ready",
      images.length > 0 &&
        images.every((image) => image.complete && image.naturalWidth > 0),
    );
  }
  useEffect(updateReady, []);
  return (
    <div
      ref={ref}
      className={`jar jar-media${staticPhoto ? " jar-static" : ""}`}
      onLoad={updateReady}
      onError={updateReady}
    >
      {children}
    </div>
  );
}
