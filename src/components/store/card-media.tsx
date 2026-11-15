"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Holds the card's reveal until every image inside it has settled, so the jar
 * and the serving photograph arrive in one motion.
 *
 * The jar was already atomic on its own (`JarMedia`), but the serving half had
 * separate readiness: measured on a slow link, a finished and hover-animatable
 * jar sat beside a blank panel for 1.3 s before the photograph appeared. The
 * reveal itself is unchanged — it is keyed on scroll position, and this adds
 * the second condition it was missing.
 *
 * A staff-replaced image resolves through Cloudinary and the optimizer while
 * its siblings come from `catalog-set`, so the two sources settle at different
 * times; waiting for all of them is what keeps that difference invisible.
 */
export function CardMedia({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const media = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = media.current;
    if (!node) return;
    // Idempotent, so the fallback timer firing after a normal open does nothing.
    const open = () => {
      if (node.hasAttribute("data-ready")) return;
      node.setAttribute("data-ready", "");
    };
    // `complete` is true after a failed load as well, so one broken image
    // settles the gate instead of hiding the card for good.
    const check = () => {
      if ([...node.querySelectorAll("img")].every((image) => image.complete))
        open();
    };

    // `load` does not bubble, so these listen in the capture phase. They stay
    // on for the element's life: whenever the images settle, the gate opens.
    node.addEventListener("load", check, true);
    node.addEventListener("error", check, true);
    check();

    // Last resort, so an image that never settles cannot leave a card
    // invisible. Armed on approach rather than on mount: the cards below the
    // fold are lazy, and a timer started with the page expires long before
    // anyone scrolls to them — which opened the gate on a card whose images had
    // not even been requested, restoring the pop-in on exactly the long phone
    // list the gate exists for.
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      fallback ??= setTimeout(open, 3000);
    };
    const approach =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries)
                if (entry.isIntersecting) {
                  arm();
                  approach?.disconnect();
                }
            },
            { rootMargin: "200px 0px" },
          )
        : null;
    if (approach) approach.observe(node);
    else arm();

    return () => {
      clearTimeout(fallback);
      approach?.disconnect();
      node.removeEventListener("load", check, true);
      node.removeEventListener("error", check, true);
    };
  }, []);

  return (
    <div ref={media} className={className}>
      {children}
    </div>
  );
}
