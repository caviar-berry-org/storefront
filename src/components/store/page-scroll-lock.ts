let lockedScroll: { x: number; y: number } | undefined;

export function storefrontScrollY() {
  return lockedScroll?.y ?? window.scrollY;
}

export function lockPageScroll() {
  const root = document.documentElement;
  if (root.classList.contains("lock")) return;
  if (matchMedia("(pointer: coarse)").matches) {
    lockedScroll = { x: window.scrollX, y: window.scrollY };
    root.style.setProperty("--locked-page-top", `${-lockedScroll.y}px`);
  }
  root.classList.add("lock");
}

export function unlockPageScroll() {
  const root = document.documentElement;
  root.classList.remove("lock");
  root.style.removeProperty("--locked-page-top");
  if (lockedScroll) {
    const { x, y } = lockedScroll;
    lockedScroll = undefined;
    window.scrollTo({ left: x, top: y, behavior: "instant" });
  }
}
