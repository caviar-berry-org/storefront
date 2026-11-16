"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  emptyTrendBuckets,
  orderTrendModel,
  orderTrendPeriods,
  type OrderTrendModel,
  type OrderTrendPeriod,
} from "@/domain/order-metrics";
import { chartHeight } from "@/domain/chart";
import {
  queryOrderTrend,
  type OrderTrendData,
} from "@/app/(staff)/admin/actions";
import { staffCopy } from "@/i18n/staff-uk";
import { CatalogGroup } from "./catalog/catalog-group";
import { StaffIcon } from "./staff-icon";
import { StaffNotice, StaffSpinner } from "./staff-feedback";
import styles from "./orders-trend.module.css";

const copy = staffCopy.dashboard.trend;
/** `18.09.26` — the same reading as the axis, with the year spelled out once. */
const kyivRangeDate = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "Europe/Kyiv",
});

type Loaded = Partial<Record<OrderTrendPeriod, OrderTrendData>>;
type Failure = "session" | "invalid" | "unavailable";

/** Width of the sheet before the container has been measured. */
const assumedWidth = 920;

function PeriodTabs({
  selected,
  busy,
  onSelect,
}: {
  selected: OrderTrendPeriod;
  busy: boolean;
  onSelect: (period: OrderTrendPeriod) => void;
}) {
  return (
    <div
      className={styles.periodTabs}
      role="group"
      aria-label={copy.periodLabel}
    >
      {orderTrendPeriods.map((period) => (
        <button
          key={period}
          type="button"
          onClick={() => onSelect(period)}
          aria-pressed={period === selected}
          disabled={busy && period !== selected}
        >
          {copy.periods[period]}
        </button>
      ))}
    </div>
  );
}

function PeriodRange({ data }: { data: OrderTrendData }) {
  // Exact days, not "last month": staff compare these against the order list.
  const { firstDay, lastDay } = data.window;
  return (
    <p className={styles.range}>
      {copy.rangeFrom}{" "}
      <time dateTime={firstDay}>
        {kyivRangeDate.format(new Date(`${firstDay}T12:00:00Z`))}
      </time>{" "}
      {copy.rangeTo}{" "}
      <time dateTime={lastDay}>
        {kyivRangeDate.format(new Date(`${lastDay}T12:00:00Z`))}
      </time>
    </p>
  );
}

/** The reading at one bucket, pinned beside the point it describes. */
function Readout({ model, index }: { model: OrderTrendModel; index: number }) {
  const column = model.columns[index];
  if (!column) return null;
  const highest = Math.min(
    ...model.series.map((line) => line.points[index]?.y ?? model.plot.bottom),
  );
  // Flip to the left once the column is past the middle, so the card never
  // hangs off the sheet — and anchor it by the edge it is flipping towards.
  // An absolutely positioned box shrinks to `container − left`, so a card
  // held by `left` near the right edge is squeezed into a sliver however far
  // a transform then moves it, and its label rides over its own figure.
  const past = column.x > (model.plot.left + model.plot.right) / 2;
  return (
    <div
      className={styles.readout}
      data-side={past ? "left" : "right"}
      style={{
        ...(past
          ? { right: `${Math.max(0, model.width - column.x)}px` }
          : { left: `${column.x}px` }),
        top: `${Math.max(model.plot.top, highest - 10)}px`,
      }}
      // Not a live region: it changes on every pointer move, and the list
      // under the chart is the version a screen reader is meant to read.
      aria-hidden="true"
    >
      <p className={styles.readoutDay}>{column.label}</p>
      <ul>
        {model.series.map((line) => (
          <li key={line.group} data-group={line.group}>
            <span className={styles.key} aria-hidden="true" />
            <span className={styles.readoutName}>
              {copy.groups[line.group]}
            </span>
            <span className={styles.readoutValue}>
              {column.counts[line.group]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Axes, grid and dates are the sheet itself and are drawn whether or not
 * anything has been counted yet; only the lines wait for the data.
 */
function ChartSheet({
  model,
  period,
  lines,
  children,
}: {
  model: OrderTrendModel;
  period: OrderTrendPeriod;
  lines: boolean;
  children?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const track = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const box = svg.current?.getBoundingClientRect();
      if (!box) return;
      // The sheet is drawn at 1:1, so a client offset is already a sheet unit.
      const x = event.clientX - box.left;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (const column of model.columns) {
        const distance = Math.abs(column.x - x);
        if (distance < best) {
          best = distance;
          nearest = column.index;
        }
      }
      setHover(nearest);
    },
    [model],
  );

  const guide = lines && hover !== null ? model.columns[hover] : null;

  return (
    <div className={styles.plotArea} style={{ blockSize: `${model.height}px` }}>
      <svg
        ref={svg}
        width={model.width}
        height={model.height}
        viewBox={`0 0 ${model.width} ${model.height}`}
        className={styles.chartSvg}
        role="img"
        aria-label={copy.chartAlt.replace(
          "{count}",
          String(model.columns.length),
        )}
        onPointerMove={lines ? track : undefined}
        onPointerLeave={lines ? () => setHover(null) : undefined}
      >
        {model.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={model.plot.left - 6}
              x2={model.plot.right}
              y1={tick.y}
              y2={tick.y}
              className={tick.value === 0 ? styles.base : styles.grid}
            />
            <text
              x={model.plot.left - 10}
              y={tick.y + 4}
              className={styles.tick}
              textAnchor="end"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* The same rails the dates stand on, so the eye can carry a point
            down to its day without guessing. */}
        {model.labels.map((label) => (
          <line
            key={`rail-${label.index}`}
            x1={label.x}
            x2={label.x}
            y1={model.plot.top}
            y2={model.plot.bottom}
            className={styles.grid}
          />
        ))}

        {model.labels.map((label) => (
          <text
            key={label.index}
            x={label.x}
            y={model.plot.bottom + 20}
            className={styles.axisLabel}
            textAnchor={
              label.index === 0
                ? "start"
                : label.index === model.columns.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {label.text}
          </text>
        ))}

        {guide && (
          <line
            x1={guide.x}
            x2={guide.x}
            y1={model.plot.top}
            y2={model.plot.bottom}
            className={styles.guide}
          />
        )}

        {/* Keyed on the window so the lines draw themselves in again when the
            period changes, instead of snapping to the new shape. */}
        {lines && (
          <g key={period} className={styles.lines}>
            {model.series.map((line) => (
              <g key={line.group} data-group={line.group}>
                <path d={line.path} className={styles.line} />
                {hover !== null && line.points[hover] && (
                  <circle
                    cx={line.points[hover]!.x}
                    cy={line.points[hover]!.y}
                    r={4}
                    className={styles.marker}
                  />
                )}
              </g>
            ))}
          </g>
        )}
      </svg>
      {lines && hover !== null && <Readout model={model} index={hover} />}
      {children && <div className={styles.overlay}>{children}</div>}
    </div>
  );
}

/**
 * The same numbers as plain text. The chart shows the shape of the period;
 * this is what staff copy into a report, and the only version a screen reader
 * reads.
 */
function TrendBreakdown({ model }: { model: OrderTrendModel }) {
  const { series, orders } = model;
  return (
    <ol className={styles.breakdown} aria-label={copy.readingLabel}>
      {series.map((line) => (
        <li key={line.group} data-group={line.group}>
          <span className={styles.key} aria-hidden="true" />
          <span className={styles.name}>{copy.groups[line.group]}</span>
          <span className={styles.count}>{line.total}</span>
          {/* Rounded independently, so the shares need not add up to exactly
              100 — forcing a total would show one group a number it did not
              earn. */}
          <span className={styles.share}>
            {orders ? Math.round((line.total / orders) * 1000) / 10 : 0}%
          </span>
        </li>
      ))}
      <li className={styles.total}>
        <span />
        <span className={styles.name}>{copy.totalLabel}</span>
        <span className={styles.count}>{orders}</span>
        <span className={styles.share}>100%</span>
      </li>
    </ol>
  );
}

export function OrdersTrendPanel() {
  const [period, setPeriod] = useState<OrderTrendPeriod>("week");
  const [loaded, setLoaded] = useState<Loaded>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const wanted = useRef<OrderTrendPeriod>("week");

  const load = useCallback(async (next: OrderTrendPeriod, cached: Loaded) => {
    setPeriod(next);
    wanted.current = next;
    setFailure(null);
    // Already in hand: no request, no spinner, no Firestore.
    if (cached[next]) return;
    setBusy(true);
    const result = await queryOrderTrend(next);
    // A slower answer for a window nobody is looking at any more is dropped.
    if (wanted.current !== next) return;
    setBusy(false);
    if ("error" in result) setFailure(result.error);
    else setLoaded((current) => ({ ...current, [next]: result }));
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [opened]);

  const data = loaded[period];
  const model = useMemo(
    () => (data ? orderTrendModel(data.buckets, width || assumedWidth) : null),
    [data, width],
  );
  // The dates come from the same pure window function the server counts over,
  // so the empty sheet already names the days the lines will land on. Built
  // only once the container has been measured, which is also the first moment
  // the client is past hydration and may read the clock.
  const skeleton = useMemo(
    () => (width ? orderTrendModel(emptyTrendBuckets(period), width) : null),
    [period, width],
  );
  const sheet = model ?? skeleton;
  const notice = failure && (
    <StaffNotice
      message={failure === "session" ? copy.sessionLost : copy.unavailable}
      guidance={failure === "session" ? "technical" : "retry"}
    />
  );

  return (
    <CatalogGroup title={copy.title} help={copy.helpText}>
      {opened && (
        <div className={styles.periodRow}>
          <PeriodTabs
            selected={period}
            busy={busy}
            onSelect={(next) => void load(next, loaded)}
          />
          {data && <PeriodRange data={data} />}
        </div>
      )}
      <div className={styles.frame} ref={frame}>
        {sheet ? (
          <ChartSheet
            model={sheet}
            period={period}
            lines={Boolean(model && !model.empty)}
          >
            {!opened ? (
              <button
                type="button"
                className={styles.reveal}
                aria-label={copy.revealLabel}
                onClick={() => {
                  setOpened(true);
                  void load("week", loaded);
                }}
              >
                <span className={styles.revealIcon} aria-hidden="true">
                  <StaffIcon name="eye" />
                </span>
                <span className={styles.revealText}>{copy.reveal}</span>
              </button>
            ) : busy && !model ? (
              <StaffSpinner />
            ) : !model ? (
              notice
            ) : model.empty ? (
              <p className={styles.empty}>{copy.empty}</p>
            ) : null}
          </ChartSheet>
        ) : (
          <div
            className={styles.placeholder}
            style={{ blockSize: `${chartHeight}px` }}
          />
        )}
        {busy && model && (
          <span className={styles.refreshing}>
            <StaffSpinner />
          </span>
        )}
      </div>
      {model && !model.empty && <TrendBreakdown model={model} />}
      {model && notice}
    </CatalogGroup>
  );
}
