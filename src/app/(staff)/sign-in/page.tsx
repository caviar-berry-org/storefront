import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/staff/google-sign-in";
import { StaffIcon } from "@/components/staff/staff-icon";
import styles from "@/components/staff/staff.module.css";
import { staffCopy } from "@/i18n/staff-uk";
import { getStaffSession, staffSettings } from "@/lib/server/staff-session";

const copy = staffCopy.signIn;

export const metadata: Metadata = { title: copy.title };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getStaffSession()) redirect("/admin");
  const config = staffSettings()?.web;

  return (
    <main className={styles.signInPage}>
      <section
        className={styles.signInCard}
        aria-labelledby="staff-sign-in-title"
      >
        <div className={styles.signInHeading}>
          <span className={styles.queueIcon}>
            <StaffIcon name="lock" />
          </span>
          <h1 id="staff-sign-in-title">{copy.title}</h1>
        </div>
        <GoogleSignIn config={config} />
      </section>
    </main>
  );
}
