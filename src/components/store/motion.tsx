"use client";
import { useEffect } from "react";
import { localeFromPath, localizedPath } from "@/i18n/routing";
import { usePathname } from "next/navigation";
import { storefrontScrollY } from "./page-scroll-lock";
import { completeSectionScroll } from "./storefront-navigation";

export function Motion({
  outsideStorefront = false,
}: {
  outsideStorefront?: boolean;
}) {
  const path = usePathname();
  const home = localizedPath(localeFromPath(path));
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hb");
    // The storefront effect mounts inside the page's hydration boundary.
    if (outsideStorefront && (path === home || hero)) return;
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const { connection } = navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean; effectiveType?: string };
    };
    const supportsObservation = typeof IntersectionObserver === "function";
    const iosWebKit = CSS.supports("-webkit-touch-callout", "none");
    const { userAgent } = navigator;
    const safariPhotos =
      iosWebKit ||
      (/Safari\//.test(userAgent) &&
        !/(?:Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|SamsungBrowser)\//.test(
          userAgent,
        ));
    root.classList.toggle("safari-photo-safe", safariPhotos);
    const embeddedBrowser =
      /\b(?:Instagram|FBAN|FBAV|FB_IAB|Discord|Telegram)\b|;\s*wv\)/i.test(
        userAgent,
      ) ||
      (/iPhone|iPad|iPod/i.test(userAgent) &&
        !/(?:Safari|CriOS|FxiOS|EdgiOS|OPiOS)\//.test(userAgent));
    const staticMode = new URLSearchParams(location.search).has("static");
    const allowMotion = () =>
      supportsObservation &&
      !reduced.matches &&
      !staticMode &&
      !connection?.saveData &&
      connection?.effectiveType !== "2g" &&
      connection?.effectiveType !== "slow-2g";
    root.classList.toggle("rm", !allowMotion());
    if (staticMode) {
      root.classList.add("static");
      root.style.setProperty(
        "--svh",
        `${Math.min(1600, Math.max(320, Number(new URLSearchParams(location.search).get("vh")) || innerHeight))}px`,
      );
    }
    const header = document.getElementById("hdr");
    const logo = document.querySelector<HTMLElement>(".header-emblem");
    const logoLink = logo?.parentElement;
    const heroCopy = hero?.querySelector(".hb-text");
    const reveal = supportsObservation
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("b-in");
                reveal?.unobserve(entry.target);
              }
            }),
          { rootMargin: "0px 0px -8% 0px" },
        )
      : null;
    const elements = document.querySelectorAll(
      ".b-rv, [data-split]:not(.hb [data-split]), .b-img",
    );
    elements.forEach((element) => reveal?.observe(element));
    const jars =
      supportsObservation && matchMedia("(hover:none)").matches
        ? new IntersectionObserver(
            (entries) =>
              entries.forEach((entry) =>
                entry.target.classList.toggle(
                  "t-open",
                  entry.intersectionRatio > 0.6,
                ),
              ),
            { threshold: [0, 0.6, 1] },
          )
        : null;
    if (jars)
      document
        .querySelectorAll(".col-card")
        .forEach((element) => jars.observe(element));
    const videos = document.querySelectorAll<HTMLVideoElement>("video.vid");
    const videoObserver = supportsObservation
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((entry) => {
              const video = entry.target as HTMLVideoElement;
              if (!allowMotion() || embeddedBrowser || !entry.isIntersecting) {
                video.pause();
                return;
              }
              const source = video.dataset.src;
              if (source && !video.hasAttribute("src")) {
                video.preload = "auto";
                video.src = source;
              }
              if (document.visibilityState === "visible") {
                video.defaultMuted = video.muted = true;
                video.play().catch(() => {});
              } else video.pause();
            }),
          { threshold: [0, 0.2], rootMargin: "200px 0px" },
        )
      : null;
    videos.forEach((video) => videoObserver?.observe(video));
    const parallax = [...document.querySelectorAll<HTMLElement>("[data-px]")];
    const sections = [
      ...document.querySelectorAll<HTMLElement>("main > section[id]"),
    ];
    const links = [...document.querySelectorAll<HTMLElement>("[data-spy]")];
    const fixedPhotos = parallax.filter((el) => el.closest(".fx"));
    let fixedEnabled = false;
    let disposed = false;
    // Fixed media fills the viewport height, so it only frames correctly where
    // the split column is full height. Phones and portrait tablets size that
    // column by aspect ratio instead, and would show a viewport-tall crop.
    const fullHeightSplit = matchMedia(
      "(min-width: 1181px), (min-width: 641px) and (orientation: landscape)",
    );
    function placeFixedPhotos() {
      fixedEnabled =
        allowMotion() && !embeddedBrowser && fullHeightSplit.matches;
      root.classList.toggle("fx-on", fixedEnabled);
      if (!fixedEnabled || disposed) return;
      fixedPhotos.forEach((el) => {
        const rect = el.parentElement!.getBoundingClientRect();
        el.style.setProperty("--pl", `${rect.left}px`);
        el.style.setProperty("--pw", `${rect.width}px`);
      });
    }
    placeFixedPhotos();
    document.fonts.ready.then(() => {
      if (!disposed) placeFixedPhotos();
    });
    const darkBlocks = [
      ...document.querySelectorAll<HTMLElement>('[data-tone="dark"]'),
    ];
    const catalogue = document.getElementById("ikra");
    let frame = 0;
    function update() {
      frame = 0;
      const pageTop = storefrontScrollY();
      header?.classList.toggle("is-compact", pageTop > 40);
      header?.classList.toggle(
        "show-logo",
        !hero || hero.getBoundingClientRect().bottom < 140,
      );
      const active = sections.findLast(
        (el) =>
          el.getBoundingClientRect().top <=
          (header?.offsetHeight ?? 62) + innerHeight * 0.3,
      );
      links.forEach((link) => {
        if (link.dataset.spy === active?.id)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      const headerBottom = header?.getBoundingClientRect().bottom ?? 62;
      header?.classList.toggle(
        "hdr-dark",
        darkBlocks.some((element) => {
          const rect = element.getBoundingClientRect();
          const probe = headerBottom / 2;
          return (
            rect.top <= probe &&
            rect.bottom > probe &&
            (element !== hero ||
              !catalogue ||
              catalogue.getBoundingClientRect().top >
                Math.max(
                  headerBottom,
                  parseFloat(getComputedStyle(catalogue).scrollMarginTop),
                ) +
                  1)
          );
        }),
      );
      if (logo) {
        let scaleProgress = 0;
        if (heroCopy && logoLink && allowMotion()) {
          const progress = Math.min(
            1,
            Math.max(0, pageTop / (innerHeight * 0.55)),
          );
          scaleProgress = 1 - progress * progress * (3 - 2 * progress);
          if (scaleProgress > 0) {
            const clearance =
              heroCopy.getBoundingClientRect().top -
              logoLink.getBoundingClientRect().bottom -
              12;
            const travel =
              Math.min(innerHeight * 0.32, innerWidth * 0.56) +
              innerHeight * 0.065;
            scaleProgress = Math.min(
              scaleProgress,
              Math.max(0, clearance / travel),
            );
          }
        }
        logo.style.setProperty("--emblem-progress", String(scaleProgress));
      }
      if (allowMotion())
        parallax.forEach((element) => {
          if (fixedEnabled && element.closest(".fx")) return;
          const rect = element.parentElement!.getBoundingClientRect();
          if (rect.bottom > 0 && rect.top < innerHeight)
            element.style.transform = `translate3d(0,${(-(rect.top + rect.height / 2 - innerHeight / 2) / innerHeight) * 8}%,0)`;
        });
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const visibility = () => {
      videos.forEach((video) => {
        if (document.hidden || !allowMotion()) video.pause();
        else {
          videoObserver?.unobserve(video);
          videoObserver?.observe(video);
        }
      });
    };
    const motionChange = () => {
      root.classList.toggle("rm", !allowMotion());
      parallax.forEach((el) => {
        el.style.transform = "";
      });
      visibility();
      placeFixedPhotos();
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    const resize = () => {
      placeFixedPhotos();
      schedule();
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", motionChange);
    connection?.addEventListener("change", motionChange);
    update();
    root.classList.add("js");
    // The home section and dialog cleanup must commit before scrolling.
    const sectionFrame =
      hero && path === home && !outsideStorefront
        ? requestAnimationFrame(completeSectionScroll)
        : 0;
    return () => {
      disposed = true;
      reveal?.disconnect();
      jars?.disconnect();
      videoObserver?.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(sectionFrame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motionChange);
      connection?.removeEventListener("change", motionChange);
      root.classList.remove("js", "static", "fx-on", "rm");
      logo?.style.removeProperty("--emblem-progress");
      videos.forEach((v) => v.pause());
    };
  }, [home, outsideStorefront, path]);
  return null;
}
