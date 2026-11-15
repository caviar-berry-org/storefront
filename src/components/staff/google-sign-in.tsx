"use client";

import { useRef, useState } from "react";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { staffCopy } from "@/i18n/staff-uk";
import styles from "./staff.module.css";

const copy = staffCopy.signIn;

export function GoogleSignIn({ config }: { config?: FirebaseOptions }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  async function signIn() {
    if (pending.current) return;
    if (!config) {
      setDenied(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    setDenied(false);

    let accepted = false;
    try {
      const name = "staff-sign-in";
      const app =
        getApps().find((item) => item.name === name) ??
        initializeApp(config, name);
      const auth = initializeAuth(app, {
        persistence: inMemoryPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        const { user } = await signInWithPopup(auth, provider);
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: await user.getIdToken() }),
          cache: "no-store",
        });
        accepted = response.status === 204;
        if (!accepted) setDenied(true);
      } finally {
        await signOut(auth).catch(() => undefined);
      }
      if (accepted) window.location.replace("/admin");
    } catch {
      accepted = false;
      setDenied(true);
    } finally {
      if (!accepted) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <div className={styles.authAction}>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        aria-busy={busy}
        className={styles.action}
      >
        {busy ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5a9.7 9.7 0 0 0 3.1-7.5Z" />
            <path d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.5c-.9.6-2.1 1-3.5 1-2.6 0-4.9-1.8-5.7-4.2l-3.3 2.6A10 10 0 0 0 12 22ZM6.3 14a6 6 0 0 1 0-4L3 7.4a10 10 0 0 0 0 9.2ZM12 5.8c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.4L6.3 10c.8-2.4 3.1-4.2 5.7-4.2Z" />
          </svg>
        )}
        {copy.action}
      </button>
      <p role="alert" className={denied ? styles.authError : styles.srOnly}>
        {denied && copy.denied}
      </p>
    </div>
  );
}
