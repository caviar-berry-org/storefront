let pendingSection: string | undefined;
let checkedInitialFragment = false;
let sectionFrame = 0;

function scheduleSectionScroll() {
  cancelAnimationFrame(sectionFrame);
  const deadline = performance.now() + 10000;
  function finish() {
    if (!pendingSection) return;
    if (performance.now() > deadline) {
      pendingSection = undefined;
      return;
    }
    // Touch dialogs restore the page position on unlock. Scroll only afterwards.
    if (
      location.hash !== `#${pendingSection}` ||
      document.documentElement.classList.contains("lock") ||
      document.querySelector("dialog.layer[open]") ||
      !document.getElementById(pendingSection)
    ) {
      sectionFrame = requestAnimationFrame(finish);
      return;
    }
    const section = pendingSection;
    pendingSection = undefined;
    scrollToSection(section);
  }
  sectionFrame = requestAnimationFrame(finish);
}

export function requestSectionScroll(section: string) {
  pendingSection = section;
  scheduleSectionScroll();
}

export function scrollToSection(section: string) {
  const target = document.getElementById(section);
  if (section === "ikra" && matchMedia("(max-width: 760px)").matches)
    target
      ?.querySelector(".collage")
      ?.scrollTo({ left: 0, behavior: "instant" });
  const heading = target?.querySelector("h2");
  (heading ?? target)?.scrollIntoView({ block: "start", inline: "nearest" });
}

export function completeSectionScroll() {
  let section = pendingSection;
  if (!checkedInitialFragment) {
    checkedInitialFragment = true;
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (
      !section &&
      navigation &&
      navigation.type !== "back_forward" &&
      new URL(navigation.name).pathname === location.pathname
    ) {
      // Tolerate a malformed fragment so a stray "#a#b" still scrolls.
      const id = location.hash.slice(1).split("#")[0]!;
      if (document.getElementById(id)?.closest("main section[data-block]"))
        section = id;
    }
  }
  if (section) requestSectionScroll(section);
}
