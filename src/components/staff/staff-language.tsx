import type { Locale } from "@/i18n/routing";
import styles from "./staff.module.css";

export function StaffLanguage({ locale }: { locale: Locale }) {
  return (
    <span className={styles.language}>
      <svg aria-hidden="true" viewBox="0 0 24 16">
        {locale === "ua" ? (
          <>
            <path fill="#0057b7" d="M0 0h24v8H0z" />
            <path fill="#ffd700" d="M0 8h24v8H0z" />
          </>
        ) : (
          <>
            <path fill="#012169" d="M0 0h24v16H0z" />
            <path stroke="#fff" strokeWidth="3.5" d="m0 0 24 16m0-16L0 16" />
            <path stroke="#c8102e" strokeWidth="1" d="m0 0 24 16m0-16L0 16" />
            <path stroke="#fff" strokeWidth="5" d="M12 0v16M0 8h24" />
            <path stroke="#c8102e" strokeWidth="2.8" d="M12 0v16M0 8h24" />
          </>
        )}
      </svg>
      {locale.toUpperCase()}
    </span>
  );
}
