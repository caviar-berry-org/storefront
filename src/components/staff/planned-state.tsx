import styles from "./staff.module.css";

export function PlannedState({ label }: { label: string }) {
  return (
    <div className={styles.plannedState}>
      <svg
        aria-hidden="true"
        width="88"
        height="78"
        viewBox="0 0 88 78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 67h62M23 70h42" opacity=".3" />
        <path d="M29 65h-5a3 3 0 0 1 0-6h6m18 6h6a3 3 0 0 0 0-6h-7M20 43l-5 9 4 3m39-11 7 5 5-7" />
        <path
          d="M22 30a17 17 0 0 1 34 0v19c0 9-6 14-17 14s-17-5-17-14Z"
          fill="#fbfaf7"
        />
        <path d="M20 28h38l-3-5a16 16 0 0 0-32 0Z" fill="#e4e0d8" />
        <path d="M35 21v-7m8 7v-7M22 37h7m20 0h7m-18 8q2 2 4 0" />
        <circle cx="39" cy="36" r="8" fill="#f2f0eb" />
        <circle cx="39" cy="36" r="2" fill="currentColor" stroke="none" />
        <path
          d="M22 49h6l4 4h14l4-4h6v3c0 7-8 11-17 11s-17-4-17-11Z"
          fill="#e4e0d8"
        />
        <path d="M36 56h6m28-14-3-5 2-4 3 4 3-2-1-4 4 2 1 5-4 4-5 8a2 2 0 0 1-4-2l4-6Z" />
      </svg>
      <span className={styles.srOnly}>{label}</span>
    </div>
  );
}
