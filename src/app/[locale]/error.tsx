"use client";
import { StatusPage } from "@/components/ui/status-page";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <StatusPage code="500" retry={reset} />;
}
