"use client";

import { useEffect, useState } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import styles from "./dashboard-metrics.module.css";

const integer = new Intl.NumberFormat("uk-UA");
const amount = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });
const format = (value: number, currency: boolean) =>
  currency ? amount.format(value / 100) : integer.format(value);

const visitedMetrics = new Set<string>();

export function MetricValue({
  name,
  value,
  currency,
}: {
  name: string;
  value?: number;
  currency: boolean;
}) {
  const [animated, setAnimated] = useState<{
    target: number;
    value: number;
  } | null>(null);

  useEffect(() => {
    if (
      value === undefined ||
      value === 0 ||
      visitedMetrics.has(name) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const target = value;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / 450);
      setAnimated({
        target,
        value: Math.round(target * (1 - (1 - progress) ** 3)),
      });
      if (progress < 1) frame = requestAnimationFrame(tick);
      else visitedMetrics.add(name);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [name, value]);

  if (value === undefined)
    return (
      <p
        className={styles.value}
        aria-label={staffCopy.dashboard.metricUnavailable}
      >
        —
      </p>
    );
  const final = format(value, currency);
  const display = animated?.target === value ? animated.value : value;
  return (
    <p className={styles.value} aria-label={final} title={final}>
      <span aria-hidden="true">{format(display, currency)}</span>
    </p>
  );
}
