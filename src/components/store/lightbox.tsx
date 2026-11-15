"use client";
import { useTranslator } from "@/i18n/client";
import { useState, useRef } from "react";
import { FadingPhoto } from "./fading-photo";
import { Dialog } from "@/components/ui/dialog";
export function Lightbox({
  photos,
  initial,
  onClose,
}: {
  photos: { src: string; alt: string }[];
  initial: number;
  onClose: () => void;
}) {
  const t = useTranslator();
  const [index, setIndex] = useState(initial);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const start = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const pinched = useRef(false);
  function distance() {
    const [a, b] = [...points.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  const photo = photos[index]!;
  function show(next: number) {
    setIndex((next + photos.length) % photos.length);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }
  function zoom(next: number) {
    setScale(Math.max(1, Math.min(4, next)));
    if (next <= 1) setOffset({ x: 0, y: 0 });
  }
  return (
    <Dialog
      title={t("lightbox.title1")}
      kind="full"
      className="photo-lightbox"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          show(index - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          show(index + 1);
        }
        if (event.key === "+" || event.key === "=") zoom(scale * 1.5);
        if (event.key === "-") zoom(scale / 1.5);
      }}
    >
      <div
        className="zoom-stage"
        onDoubleClick={() => zoom(scale > 1 ? 1 : 2.5)}
        onWheel={(event) => zoom(scale + (event.deltaY < 0 ? 0.2 : -0.2))}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          points.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (points.current.size === 2) {
            pinch.current = { distance: distance(), scale };
            pinched.current = true;
            start.current = null;
            return;
          }
          start.current = {
            x: event.clientX,
            y: event.clientY,
            ox: offset.x,
            oy: offset.y,
          };
        }}
        onPointerMove={(event) => {
          if (points.current.has(event.pointerId))
            points.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
          if (pinch.current && points.current.size === 2) {
            zoom(
              (pinch.current.scale * distance()) /
                Math.max(1, pinch.current.distance),
            );
            return;
          }
          if (start.current && scale > 1)
            setOffset({
              x: Math.max(
                -innerWidth,
                Math.min(
                  innerWidth,
                  start.current.ox + event.clientX - start.current.x,
                ),
              ),
              y: Math.max(
                -innerHeight,
                Math.min(
                  innerHeight,
                  start.current.oy + event.clientY - start.current.y,
                ),
              ),
            });
        }}
        onPointerUp={(event) => {
          points.current.delete(event.pointerId);
          pinch.current = null;
          if (pinched.current) {
            if (!points.current.size) pinched.current = false;
            start.current = null;
            return;
          }
          if (
            start.current &&
            scale === 1 &&
            Math.abs(event.clientX - start.current.x) > 70
          )
            show(index + (event.clientX < start.current.x ? 1 : -1));
          start.current = null;
        }}
        onPointerCancel={() => {
          points.current.clear();
          pinch.current = null;
          pinched.current = false;
          start.current = null;
        }}
      >
        <FadingPhoto
          src={photo.src}
          alt={photo.alt}
          draggable={false}
          quality={90}
          sizes="(max-width: 1500px) 92vw, 1400px"
          loading="eager"
          replaceOnLoad
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
      <button
        className="zoom-nav zoom-prev"
        aria-label={t("lightbox.ariaLabel1")}
        onClick={() => show(index - 1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15.5 5-7 7 7 7" />
        </svg>
      </button>
      <button
        className="zoom-nav zoom-next"
        aria-label={t("lightbox.ariaLabel2")}
        onClick={() => show(index + 1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8.5 5 7 7-7 7" />
        </svg>
      </button>
      <div className="zoom-bar">
        <button
          className="zoom-btn"
          onClick={() => zoom(scale / 1.5)}
          aria-label={t("lightbox.ariaLabel3")}
        >
          −
        </button>
        <span className="zoom-count" aria-live="polite">
          {index + 1} / {photos.length}
        </span>
        <button
          className="zoom-btn"
          onClick={() => zoom(scale * 1.5)}
          aria-label={t("lightbox.ariaLabel4")}
        >
          +
        </button>
      </div>
    </Dialog>
  );
}
