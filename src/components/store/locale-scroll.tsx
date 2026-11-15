"use client";

import { storefrontScrollY } from "./page-scroll-lock";
import { useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const key = "ucb-locale-scroll";
const maxPositionAge = 15000;
const landmarkSelector =
  "main [data-block], main :is(h1, h2, h3, article, .b-acc), footer[data-block]";
type ViewPosition = {
  product: boolean;
  index: number;
  offset: number;
  scrollY: number;
};
type Position = ViewPosition & {
  destination: string;
  catalogue?: string;
  timestamp: number;
};
let pending: Position | undefined;
let menuPosition: ViewPosition | undefined;

function productPanel() {
  return document.querySelector<HTMLElement>("#pmodal[open] > .panel");
}

function landmarks(panel: HTMLElement | null, product: boolean) {
  const root = product
    ? (panel ?? document.querySelector("main.product-page"))
    : document;
  const productSelector = matchMedia("(max-width: 640px)").matches
    ? ".pp-photo, h1, h2, h3, .b-acc"
    : ".pp-photo";
  return Array.from(
    root?.querySelectorAll(product ? productSelector : landmarkSelector) ?? [],
  );
}

function capturePosition(): ViewPosition {
  const panel = productPanel();
  const product = Boolean(panel || document.querySelector("main.product-page"));
  const scrollY = panel?.scrollTop ?? storefrontScrollY();
  const probe =
    (document.getElementById("hdr")?.getBoundingClientRect().bottom ?? 0) + 12;
  let index = -1;
  let offset = 0;
  let nearest = Infinity;
  if (scrollY > 0) {
    landmarks(panel, product).forEach((element, candidate) => {
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top - probe);
      if (rect.height && rect.top <= probe + 48 && distance < nearest) {
        index = candidate;
        nearest = distance;
        offset = -rect.top;
      }
    });
  }
  return {
    product,
    index,
    offset,
    scrollY,
  };
}

export function captureLocaleMenuPosition() {
  menuPosition = capturePosition();
}

function savePosition(position: Position) {
  pending = position;
  try {
    sessionStorage.setItem(key, JSON.stringify(position));
    return true;
  } catch {
    return false;
  }
}

export function rememberLocalePosition(
  destination: string,
  fromMenu: boolean,
  catalogue?: string,
) {
  const stored = savePosition({
    ...(fromMenu && menuPosition ? menuPosition : capturePosition()),
    destination,
    catalogue,
    timestamp: Date.now(),
  });
  menuPosition = undefined;
  const root = document.documentElement;
  root.dataset.localeSwitching = "";
  window.setTimeout(() => delete root.dataset.localeSwitching, 3000);
  return stored;
}

function readPosition() {
  let saved = pending;
  if (!saved) {
    try {
      saved = JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined;
    } catch {
      return;
    }
  }
  if (saved && Date.now() - saved.timestamp < maxPositionAge) return saved;
}

function takePosition(destination: string) {
  const saved = readPosition();
  if (saved?.destination !== destination) return;
  pending = undefined;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // The position has already been consumed in memory.
  }
  return saved;
}

export function LocaleScroll({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useLayoutEffect(() => {
    const saved = readPosition();
    if (
      saved?.catalogue === pathname &&
      typeof saved.destination === "string" &&
      /^\/(?:ua|en)\/products\/[a-z0-9-]+$/.test(saved.destination) &&
      saved.destination.startsWith(pathname + "/")
    ) {
      // The translated catalogue must commit before its product can be intercepted.
      const frame = requestAnimationFrame(() => {
        savePosition({ ...saved, catalogue: undefined });
        document
          .getElementById("ikra")
          ?.scrollIntoView({ behavior: "instant" });
        router.push(saved.destination + location.search, {
          scroll: false,
        });
      });
      return () => cancelAnimationFrame(frame);
    }
    const position = takePosition(pathname);
    delete document.documentElement.dataset.localeSwitching;
    if (!position) return;
    const { index, offset, scrollY, product } = position;

    function restore() {
      const panel = product ? productPanel() : null;
      const scroll = panel?.scrollTop ?? storefrontScrollY();
      const landmark = landmarks(panel, product)[index];
      const top = landmark
        ? scroll + landmark.getBoundingClientRect().top + offset
        : scrollY;
      (panel ?? window).scrollTo({ top, behavior: "instant" });
    }

    const settling = new AbortController();
    let frame = 0;
    function scheduleRestore() {
      if (settling.signal.aborted) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    }
    const resize = new ResizeObserver(scheduleRestore);
    resize.observe(document.body);
    const landmark = landmarks(product ? productPanel() : null, product)[index];
    if (landmark) resize.observe(landmark);
    const section = landmark?.closest("section, main");
    if (section && section !== landmark) resize.observe(section);
    const timeout = window.setTimeout(stop, 2000);
    function stop() {
      settling.abort();
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      resize.disconnect();
    }
    for (const event of ["wheel", "pointerdown", "touchstart", "keydown"]) {
      window.addEventListener(event, stop, {
        capture: true,
        passive: true,
        signal: settling.signal,
      });
    }
    restore();
    scheduleRestore();
    void document.fonts.ready.then(() => {
      scheduleRestore();
    });
    return stop;
  }, [locale, pathname, router]);

  return (
    <p className="locale-progress" role="status">
      {label}
    </p>
  );
}
