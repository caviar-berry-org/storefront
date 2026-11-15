"use client";
import { useEffect, useState } from "react";
import { localizedPath, locales } from "@/i18n/routing";

// Change the stylesheet, so the initial HTML remains the same during hydration.
const bootstrap = `
(() => {
  if (new URLSearchParams(location.search).has("static")) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.onLine === false) return;
  const [splash, intro] = document.getElementById("session-splash-style")?.sheet?.cssRules ?? [];
  if (!splash || !intro) return;

  const home = ${JSON.stringify(locales.map((locale) => localizedPath(locale)))}.includes(location.pathname);
  const connection = navigator.connection;
  const playIntro = home && (!location.hash || location.hash === "#top") &&
    !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType);
  if (playIntro) {
    intro.style.setProperty("--hero-fade", "hero-fade-in");
    intro.style.setProperty("--hero-word", "hero-word-in");
    intro.style.setProperty("--hero-intro-state", "paused");
  }

  let showSplash = false;
  try {
    if (!sessionStorage.getItem("ucb-loaded")) {
      sessionStorage.setItem("ucb-loaded", "1");
      showSplash = true;
    }
  } catch {}
  if (!showSplash && !playIntro) return;

  if (showSplash) splash.style.display = "grid";
  const started = performance.now();
  let dismissed = false;
  const fallback = setTimeout(dismiss, 1800);

  function revealHero() {
    if (!playIntro) return;
    const hero = document.querySelector(".hb-roe");
    if (!hero?.complete || !hero.naturalWidth || navigator.onLine === false || window.scrollY > 40) {
      intro.style.cssText = "";
      return;
    }
    intro.style.setProperty("--hero-intro-state", "running");
    setTimeout(() => { intro.style.cssText = ""; }, 3000);
  }
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(fallback);
    window.removeEventListener("load", ready);
    document.removeEventListener("focusin", dismiss);
    if (!showSplash) {
      revealHero();
      return;
    }
    splash.style.pointerEvents = "none";
    splash.style.animation = "splash-exit 280ms ease both";
    setTimeout(() => {
      splash.style.display = "none";
      revealHero();
    }, 280);
  }
  function ready() {
    setTimeout(dismiss, Math.max(0, (showSplash ? 350 : 150) - (performance.now() - started)));
  }
  if (showSplash) document.addEventListener("focusin", dismiss, { once: true });
  if (document.readyState === "complete") ready();
  else window.addEventListener("load", ready, { once: true });
})();
`;

// The bootstrap belongs to the initial document only: it runs at parse time, before
// first paint. A locale switch remounts the `[locale]` root layout, and React would
// then re-create this <script> on the client, where scripts never execute — it only
// adds an inert node and a console error. Render it for the first document, then stop.
// The source stays in this module rather than arriving as a prop, so it is never
// serialized into the RSC payload on every locale switch.
let bootstrapped = false;

export function SplashBootstrap() {
  // The server always renders it (the effect never runs there), so the initial HTML
  // keeps the script and hydration matches. Later client remounts read the flag.
  const [include] = useState(() => !bootstrapped);
  useEffect(() => {
    bootstrapped = true;
  }, []);
  if (!include) return null;
  return <script dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
