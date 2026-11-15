import { ui } from "@/components/ui/styles";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { Photo } from "@/components/ui/photo";
const logos = [
  { src: "/assets/logos/socar.svg", alt: "partners.alt1" },
  { src: "/assets/logos/okwine.svg", alt: "partners.alt2" },
  { src: "/assets/logos/opera-color.webp", alt: "partners.opera" },
  { src: "/assets/logos/bassano.svg", alt: "partners.bassano" },
] as const;
export function PartnersSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  return (
    <div
      className={`b-partners flex items-center gap-[32px] p-[18px_0] [border-block:1px_dotted_var(--b-dot)] overflow-hidden`}
    >
      <span className={`b-label ${ui.bLabel}`}>{t("partners.text1")}</span>
      <div className="marq" aria-hidden="true">
        {[0, 1].map((track) => (
          <div className="marq-track" key={track}>
            {[...logos, ...logos].map((logo, i) => (
              <Photo
                key={i}
                className={`plogo flex-none h-[46px] w-auto object-contain [mix-blend-mode:multiply]`}
                src={logo.src}
                alt={t(logo.alt)}
                sizes="180px"
              />
            ))}
          </div>
        ))}
      </div>
      <p className="sr">{t("partners.paragraph1")}</p>
    </div>
  );
}
