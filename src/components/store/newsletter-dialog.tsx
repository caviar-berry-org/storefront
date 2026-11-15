import { useState } from "react";
import { SubmissionStage } from "./submission-stage";
import { useStore } from "./store-provider";
import { useTranslator } from "@/i18n/client";
import { BrandStamp } from "@/components/ui/brand-stamp";
import { NewsletterForm } from "./newsletter-form";
import { usePromotionOffer } from "./promotion-offer";
export function NewsletterDialog() {
  const t = useTranslator();
  const [success, setSuccess] = useState(false);
  const { setOverlay } = useStore();
  const offer = usePromotionOffer();
  return (
    <>
      <div className="promo-stamp grid min-h-full place-items-center self-stretch bg-[var(--p-premium)] p-5 max-[560px]:hidden">
        <BrandStamp />
      </div>
      <SubmissionStage
        success={success}
        title={t("submission.promoTitle")}
        description={t("submission.promoBody")}
        onClose={() => setOverlay(null)}
      >
        <div className="px-7 pt-9 pb-[calc(28px+env(safe-area-inset-bottom))]">
          <h2 className="h3 mb-2.5 pr-9">
            {t("newsletter.title", { percent: offer.percent })}
          </h2>
          <p className="text-[var(--muted)]">{t("newsletter.description")}</p>
          <NewsletterForm popup onSuccess={() => setSuccess(true)} />
        </div>
      </SubmissionStage>
    </>
  );
}
