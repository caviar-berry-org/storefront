"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { StaffBusy } from "../staff-feedback";

type NavigationOptions = { replace?: boolean; scroll?: boolean };
const Navigation = createContext<{
  pending: boolean;
  navigate: (href: string, options?: NavigationOptions) => void;
} | null>(null);

export const useAdminNavigation = () => useContext(Navigation);

export function AdminNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lock = useRef(false);

  useEffect(() => {
    if (!pending) lock.current = false;
  }, [pending]);

  function navigate(href: string, { replace, scroll }: NavigationOptions = {}) {
    if (lock.current) return;
    lock.current = true;
    startTransition(() => {
      if (replace) router.replace(href, { scroll });
      else router.push(href, { scroll });
    });
  }

  return (
    <Navigation.Provider value={{ pending, navigate }}>
      {children}
      {pending && <StaffBusy floating />}
    </Navigation.Provider>
  );
}
