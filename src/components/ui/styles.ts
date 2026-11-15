// Shared visual primitives; contextual motion remains in CSS.
export const ui = {
  bWrap: "pl-[16px] pr-[16px]",
  bGrid: "grid grid-cols-[repeat(12,_minmax(0,_1fr))] gap-[16px]",
  bSec: "pt-[calc(var(--sec-gap)_/_2)] pb-[calc(var(--sec-gap)_/_2)]",
  bH2: "[font-family:var(--b-cond)] font-normal uppercase text-[clamp(34px,_4.1vw,_60px)] leading-[1.04] tracking-[0.02em] max-[560px]:leading-[0.94]",
  bLabel:
    "[font-family:var(--b-wide)] font-normal text-[13px] tracking-[0.04em] uppercase leading-[1.4]",
  bP: "[font-family:var(--b-sans)] font-light text-[16px] leading-[1.4]",
  bLink:
    "inline-flex items-end gap-[16px] min-h-[44px] p-[0_0_6px] border-x-0 border-t-0 border-b border-solid border-current [background:none] [color:inherit] [font-family:var(--b-wide)] text-[13px] tracking-[0.04em] uppercase no-underline cursor-pointer [justify-self:start]",
  bBtn: "inline-flex items-center justify-center min-h-[52px] p-[0_24px] [background:var(--b-ink)] [color:var(--b-bg)] [border:1px_solid_var(--b-ink)] [font-family:var(--b-wide)] text-[13px] tracking-[0.04em] uppercase no-underline cursor-pointer",
  tcName:
    "[font-family:var(--b-cond)] font-normal uppercase text-[20px] leading-[1.15] tracking-[0.03em] max-[760px]:text-[19px]",
  draftUnderline:
    "underline decoration-dotted decoration-[rgba(200,120,40,0.8)] underline-offset-4",
  field: "grid gap-[6px]",
  in: "min-h-[52px] [border:1px_solid_var(--line)] [background:var(--bg)] p-[0_14px] text-[17px] w-full rounded-none",
} as const;
