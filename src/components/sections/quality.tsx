"use client";
import { AmbientVideo } from "@/components/store/ambient-video";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { BrandStamp } from "@/components/ui/brand-stamp";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { useEffect, useRef, useState } from "react";
import { editorialCopy, qualityStepsFor } from "@/lib/storefront-copy";
import { Accordion } from "@/components/ui/accordion";
import { Photo } from "@/components/ui/photo";
import { Arrow } from "@/components/ui/arrow";
import { StorefrontLink } from "@/components/store/storefront-link";
export function QualitySection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  const copy = editorialCopy(locale);
  const steps = qualityStepsFor(locale);
  const [active, setActive] = useState<number | null>(0);
  const [image, setImage] = useState(0);
  const ready = useRef(new Set<number>());
  const desired = useRef(0);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }
  function showImage(index: number) {
    desired.current = index;
    if (ready.current.has(index)) setImage(index);
  }
  useEffect(() => cancelHover, []);

  return (
    <>
      <div
        className={`b-split relative min-h-[calc(100svh_-_var(--hdr-h-c,_62px))] p-[calc(var(--sec-gap)_/_2)_16px] items-stretch max-[640px]:min-h-0 max-[640px]:pt-[20px] max-[640px]:pb-[20px] b-split-top b-grid ${ui.bGrid}`}
      >
        <BrandStamp />
        <div
          className={`bs-text [grid-column:1/6] flex flex-col justify-center gap-[28px] p-[80px_0] max-[640px]:p-[56px_0_24px]`}
        >
          <SplitText as="h2" className={`b-h2 ${ui.bH2} b-h2-left`}>
            {t("quality.heading1")}
            <span className="l2">{t("quality.text1")}</span>
          </SplitText>
          <div
            className={`bs-foot flex flex-col gap-[28px] max-[640px]:gap-[20px]`}
          >
            <p className={`b-p ${ui.bP} b-rv`}>{copy.nature}</p>
            <StorefrontLink className={`b-link ${ui.bLink}`} section="trace-b">
              {t("quality.link1")}
              <Arrow />
            </StorefrontLink>
          </div>
        </div>
        <div
          className={`bs-media b-img [grid-column:7/13] relative overflow-hidden min-h-[560px] max-[640px]:min-h-0 max-[640px]:aspect-[4/3] max-[560px]:aspect-[4/5]`}
        >
          <div className="px" data-px>
            <figure className="ph-b ph-img">
              <AmbientVideo
                src="/assets/video/nature-water.mp4"
                poster="/assets/img/editorial/quality/nature-water-poster.webp"
              />
            </figure>
          </div>
        </div>
      </div>
      <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`} id="trace-b">
        <SplitText as="h2" className={`b-h2 ${ui.bH2} b-center b-h2-mid`}>
          {t("quality.heading2")}
          <span className="l2">{t("quality.text2")}</span>
        </SplitText>
        <p
          className={`b-p ${ui.bP} b-lead-c max-w-[520px] [margin:24px_0_0] text-left b-lead-mid b-rv`}
        >
          {copy.traceLead}
        </p>
        <div
          className={`b-grid ${ui.bGrid} lsplit items-start trace mt-[clamp(40px,_5vw,_72px)]`}
        >
          <div
            className={`ls-media b-img framed-export [grid-column:2/6] sticky top-[72px] aspect-[1] overflow-hidden ls-bleed`}
          >
            {steps.map((step, index) => (
              <div
                key={step.n}
                className={`tr-frame${step.n === "04" ? " tr-frame--contain" : ""}${image === index ? " on" : ""}`}
                aria-hidden={image !== index}
              >
                <div
                  className={step.n === "04" ? "absolute inset-0" : "px"}
                  data-px={step.n === "04" ? undefined : true}
                >
                  <figure className="ph-b ph-img">
                    <Photo
                      src={step.image}
                      alt={step.cap}
                      onLoad={() => {
                        ready.current.add(index);
                        if (desired.current === index) setImage(index);
                      }}
                    />
                  </figure>
                </div>
              </div>
            ))}
          </div>
          <div
            className={`ls-body [grid-column:7/13] grid [justify-items:start]`}
          >
            <div className={`tr-acc w-full b-rv`}>
              {steps.map((step, index) => (
                <div
                  key={step.n}
                  onPointerMove={(event) => {
                    if (
                      event.pointerType !== "mouse" ||
                      !matchMedia("(hover: hover) and (pointer: fine)").matches
                    )
                      return;
                    cancelHover();
                    hoverTimer.current = setTimeout(
                      () => showImage(index),
                      180,
                    );
                  }}
                  onPointerLeave={cancelHover}
                  onFocusCapture={() => showImage(index)}
                >
                  <Accordion
                    open={active === index}
                    onToggle={() => {
                      cancelHover();
                      showImage(index);
                      setActive(active === index ? null : index);
                    }}
                    title={
                      <span
                        className={`tr-t grid grid-cols-[44px_1fr] [align-items:baseline]`}
                      >
                        <span
                          className={`tr-n [font-family:var(--b-wide)] text-[13px] [color:var(--b-mute)]`}
                        >
                          {step.n}
                        </span>
                        <span>{step.h}</span>
                      </span>
                    }
                  >
                    <p className={`b-p ${ui.bP}`}>{step.p}</p>
                  </Accordion>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
