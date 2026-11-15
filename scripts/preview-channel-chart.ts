/**
 * Renders the channel report to a PNG for review.
 *
 *   node scripts/preview-channel-chart.ts
 *
 * Draws from the same pure geometry and the same stylesheet the admin uses, so
 * the picture cannot drift from the page. It needs no database and no session:
 * the point is to agree the design before the Firestore index is deployed.
 *
 * Output lands in `.local/chart-preview/` (gitignored).
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { channelShares } from "../src/domain/analytics-window.ts";
import { channelChartModel } from "../src/domain/channel-chart.ts";
import { seoStaffCopy } from "../src/i18n/seo-staff-uk.ts";

const copy = seoStaffCopy.utm;
const root = process.cwd();
const outDir = path.join(root, ".local/chart-preview");

const name = (source: string) =>
  copy.channels[source as keyof typeof copy.channels] ?? source;
const money = (minor: number) =>
  `${(minor / 100).toFixed(0).replace(/\B(?=(\d{3})+$)/g, " ")} ₴`;

function chartSvg(rows: ReturnType<typeof channelShares>) {
  const m = channelChartModel(rows.rows, rows.orders);
  const ticks = m.ticks
    .map(
      (tick) =>
        `<line x1="${m.plot.left - 6}" x2="${m.axisRight}" y1="${tick.y}" y2="${tick.y}" class="${tick.value === 0 ? "chartBase" : "chartGrid"}"/>` +
        `<text x="${m.plot.left - 10}" y="${tick.y + 4}" class="chartTick" text-anchor="end">${tick.value}</text>`,
    )
    .join("");
  const average = m.average
    ? `<line x1="${m.plot.left}" x2="${m.axisRight}" y1="${m.average.y}" y2="${m.average.y}" class="chartAverage"/>` +
      `<text x="${m.axisRight}" y="${m.average.y + 15}" class="chartAverageLabel" text-anchor="end">${copy.average}</text>`
    : "";
  const pipes = m.columns
    .map(
      (c) =>
        `<g><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="${c.radius}" class="${c.lead ? "chartPipeLead" : "chartPipe"}"/>` +
        `<text x="${c.x + c.width / 2}" y="${c.y - 8}" class="chartValue" text-anchor="middle">${c.count}</text>` +
        `<text x="${c.x + c.width / 2}" y="${m.plot.bottom + 18}" class="chartLabel" text-anchor="middle">${name(c.source)}</text>` +
        `<text x="${c.x + c.width / 2}" y="${m.plot.bottom + 34}" class="chartShare" text-anchor="middle">${c.share}%</text></g>`,
    )
    .join("");
  return `<figure class="chart"><div class="chartScroll"><svg viewBox="0 0 ${m.sheet.width} ${m.sheet.height}" class="chartSvg">${ticks}${average}${pipes}</svg></div></figure>`;
}

function breakdown(rows: ReturnType<typeof channelShares>) {
  const items = rows.rows
    .map(
      (row) =>
        `<li><span class="breakdownName">${name(row.source)}</span>` +
        `<span class="breakdownCount">${copy.ordersCount.replace("{count}", String(row.count))}</span>` +
        `<span class="breakdownShare">${row.share}%</span>` +
        `<span class="breakdownRevenue">${money(row.total)}</span></li>`,
    )
    .join("");
  return `<ol class="breakdown">${items}<li class="breakdownTotal"><span class="breakdownName">${copy.totalLabel}</span><span class="breakdownCount">${copy.ordersCount.replace("{count}", String(rows.orders))}</span><span class="breakdownShare">100%</span><span class="breakdownRevenue">${money(rows.revenue)}</span></li></ol>`;
}

/** Plausible shapes, so the design is judged on more than one column. */
const scenarios = {
  week: channelShares([
    { source: "instagram", count: 9, total: 2460000 },
    { source: "google", count: 5, total: 1310000 },
    { source: "telegram", count: 3, total: 720000 },
    { source: "chatgpt", count: 2, total: 540000 },
    { source: "other", count: 1, total: 180000 },
  ]),
  month: channelShares([
    { source: "instagram", count: 34, total: 9120000 },
    { source: "google", count: 21, total: 5640000 },
    { source: "telegram", count: 12, total: 2980000 },
    { source: "facebook", count: 9, total: 2210000 },
    { source: "chatgpt", count: 7, total: 1840000 },
    { source: "email", count: 4, total: 960000 },
    { source: "offline", count: 3, total: 1120000 },
    { source: "other", count: 2, total: 390000 },
  ]),
  single: channelShares([{ source: "instagram", count: 3, total: 740000 }]),
};

const css = await readFile(
  path.join(root, "src/components/staff/seo/seo.module.css"),
  "utf8",
);
// CSS modules keep their literal selectors in the file; the preview uses the
// same names so the rules apply unchanged.
const tokens = `.sheet{--paper:#fbfaf7;--surface:#f2f0eb;--ink:#17181b;--muted:#5f6065;--gold:#c6a66b;--accent-ink:#6e572e;--border:#e4e0d8;--card:#fff;background:var(--paper);color:var(--ink);font:400 .875rem/1.5 "Montserrat",system-ui,sans-serif;padding:24px;display:grid;gap:14px}
.sheet h2{margin:0;font-size:1rem}.sheet .group{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;display:grid;gap:14px}`;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const [label, rows] of Object.entries(scenarios)) {
  const html = `<!doctype html><meta charset="utf-8"><style>${tokens}${css}</style><div class="sheet"><div class="group"><h2>${copy.conversions}</h2><div class="periodRow"><nav class="periodTabs"><a aria-current="${label === "month" ? "false" : "page"}">${copy.periods.week}</a><a aria-current="${label === "month" ? "page" : "false"}">${copy.periods.month}</a><a>${copy.periods.year}</a></nav><p class="range">${copy.rangeFrom} 8 листопада 2026 р. ${copy.rangeTo} 14 листопада 2026 р. ${copy.rangeInclusive}</p></div>${chartSvg(rows)}${breakdown(rows)}<p class="note">Дані на 14.11.26, 10:10 за київським часом</p></div></div>`;
  await writeFile(path.join(outDir, `${label}.html`), html, "utf8");
  const page = await browser.newPage({
    viewport: { width: 900, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({
    path: path.join(outDir, `${label}.png`),
    fullPage: true,
  });
  await page.close();
  console.log(`${label}: ${rows.rows.length} channels, ${rows.orders} orders`);
}
await browser.close();
console.log(`\n→ ${path.relative(root, outDir)}`);
