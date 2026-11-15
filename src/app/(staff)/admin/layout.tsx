import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/staff/shell/admin-shell";
import { InquiryCountBadge } from "@/components/staff/inquiries/inquiry-counts";
import { inquiryCounts } from "@/lib/server/inquiries/queries";
import { OrderQueueBadge } from "@/components/staff/orders/order-queue-badge";
import { staffCopy } from "@/i18n/staff-uk";
import { requireStaffSession, staffSettings } from "@/lib/server/staff-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function signOut() {
  "use server";
  const settings = staffSettings();
  if (settings) {
    (await cookies()).set(settings.cookieName, "", {
      ...settings.cookieOptions,
      maxAge: 0,
    });
  }
  redirect("/sign-in");
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireStaffSession();
  const picture =
    typeof session.picture === "string" ? URL.parse(session.picture) : null;
  const avatar =
    picture?.protocol === "https:" &&
    /^lh[0-9]+\.googleusercontent\.com$/.test(picture.hostname) &&
    !picture.username &&
    !picture.password
      ? picture.href
      : undefined;
  const name =
    typeof session.name === "string" && session.name.trim()
      ? session.name.trim()
      : staffCopy.profileFallback;

  const initiallyCollapsed =
    (await cookies()).get("staff-sidebar")?.value === "collapsed";

  return (
    <AdminShell
      signOut={signOut}
      profile={{ name, role: session.role, avatar }}
      initiallyCollapsed={initiallyCollapsed}
      initialInquiryCounts={await inquiryCounts().catch(() => null)}
      inquiryBadge={
        <Suspense fallback={null}>
          <InquiryCountBadge />
        </Suspense>
      }
      orderBadge={
        <Suspense fallback={null}>
          <OrderQueueBadge />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}
