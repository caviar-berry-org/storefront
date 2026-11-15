import appearance from "../../../content/mail/appearance.json" with { type: "json" };
import { mailBanners, mailBannerCid } from "../../../content/mail/banners.ts";
import {
  mailLogo,
  mailLogoCid,
  mailLogoHeight,
  mailLogoWidth,
} from "../../../content/mail/logo.ts";
import { documentLanguage, type Locale } from "../../../i18n/routing.ts";
import type { MailAttachment } from "./smtp.ts";
import { contacts } from "../../../content/contacts.ts";

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

/**
 * Mail bodies are described as blocks rather than raw HTML so the HTML and the
 * plain-text alternative are always generated from the same data and cannot drift.
 */
export type Block =
  /** `accent` picks one phrase out of the line in brand gold. */
  | { k: "p"; v: string; accent?: string }
  | { k: "lead"; v: string; accent?: string }
  | { k: "link"; href: string; label: string }
  | { k: "button"; href: string; label: string }
  | { k: "facts"; items: [string, string][] }
  | { k: "code"; label: string; value: string }
  | {
      k: "table";
      head: [string, string, string];
      rows: [string, string, string][];
      totals: [string, string, boolean][];
    }
  | { k: "note"; v: string }
  | { k: "signoff"; v: string; team: string };

type Palette = (typeof appearance)["light"];

function cell(palette: Palette, pad = "0 28px") {
  return `padding:${pad};font-family:${appearance.font};color:${palette.text}`;
}

function blockHtml(block: Block, p: Palette, locale: Locale): string {
  const link = (href: string, label: string, colour = p.accent) =>
    `<a href="${escapeHtml(href)}" style="color:${colour};text-decoration:underline">${escapeHtml(label)}</a>`;
  // Both sides are escaped before matching, so the needle cannot inject markup
  // and cannot miss because of an entity on one side only.
  const accented = (value: string, accent?: string) => {
    const text = escapeHtml(value);
    if (!accent) return text;
    const needle = escapeHtml(accent);
    return text.replace(
      needle,
      `<span class="a" style="color:${p.accent}">${needle}</span>`,
    );
  };
  switch (block.k) {
    case "p":
      return `<p style="${appearance.paragraph};color:${p.text}">${accented(block.v, block.accent)}</p>`;
    case "lead":
      return `<p class="m" style="${appearance.paragraph};color:${p.muted};font-size:16px">${accented(block.v, block.accent)}</p>`;
    case "note":
      return `<p class="m" style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${p.muted}">${escapeHtml(block.v)}</p>`;
    case "link":
      return `<p style="${appearance.paragraph}">${link(block.href, block.label)}</p>`;
    case "button":
      // Table-wrapped so Outlook renders the filled shape rather than a bare link.
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px"><tr><td class="btn" style="background:${p.button}"><a class="btnt" href="${escapeHtml(block.href)}" style="display:inline-block;padding:16px 30px;font-family:${appearance.font};font-size:13px;font-weight:500;letter-spacing:1.3px;text-transform:uppercase;color:${p.buttonText};text-decoration:none">${escapeHtml(block.label)}</a></td></tr></table>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${block.items
        .map(
          ([label, value]) =>
            `<tr><td class="m nw lb" style="width:38%;padding:10px 0 7px;${appearance.label};line-height:1.5;color:${p.muted};white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td class="t" style="padding:7px 0 7px 16px;font-size:15px;line-height:1.5;color:${p.text};vertical-align:top">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`;
    case "code":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td class="bd" align="center" style="padding:18px 16px;border:1px solid ${p.border};text-align:center"><div class="m" style="${appearance.label};color:${p.muted};padding-bottom:8px">${escapeHtml(block.label)}</div><div class="t" style="font-family:${appearance.font};font-size:24px;line-height:1.2;letter-spacing:3px;font-weight:600;color:${p.text};overflow-wrap:anywhere">${escapeHtml(block.value)}</div></td></tr></table>`;
    case "table": {
      const th = `padding:10px 8px;${appearance.label};color:${p.muted};border-bottom:1px solid ${p.border}`;
      const td = `padding:11px 8px;font-size:14px;line-height:1.5;color:${p.text};border-bottom:1px solid ${p.border}`;
      const rows = block.rows
        .map(
          ([name, qty, sum], i) =>
            `<tr${i % 2 ? ` class="zb" style="background:${p.zebra}"` : ""}><td class="t bd tc" style="${td}">${escapeHtml(name)}</td><td class="t bd tc nw" style="${td};text-align:center;white-space:nowrap">${escapeHtml(qty)}</td><td class="t bd tc" style="${td};text-align:right;white-space:nowrap">${escapeHtml(sum)}</td></tr>`,
        )
        .join("");
      const totals = block.totals
        .map(([label, value, strong]) => {
          const base = `padding:${strong ? "12px 8px 0" : "7px 8px 0"};font-size:${strong ? 16 : 14}px;text-align:right;color:${strong ? p.text : p.muted}${strong ? ";font-weight:600" : ""}`;
          const cls = strong ? "t" : "m";
          return `<tr><td colspan="2" class="${cls}" style="${base}">${escapeHtml(label)}</td><td class="${cls}" style="${base};white-space:nowrap">${escapeHtml(value)}</td></tr>`;
        })
        .join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse"><tr><td class="m bd tc" style="${th}">${escapeHtml(block.head[0])}</td><td class="m bd tc" style="${th};text-align:center">${escapeHtml(block.head[1])}</td><td class="m bd tc" style="${th};text-align:right">${escapeHtml(block.head[2])}</td></tr>${rows}${totals}</table>`;
    }
    case "signoff":
      return `<p style="margin:26px 0 0;font-family:${appearance.display};font-size:17px;line-height:1.6;color:${p.text}">${escapeHtml(block.v)}<br><span class="a" style="color:${p.accent}">${escapeHtml(block.team)}</span></p>`;
  }
  void locale;
  return "";
}

function blockText(block: Block): string[] {
  switch (block.k) {
    case "p":
    case "lead":
    case "note":
      return [block.v];
    case "link":
      return [`${block.label}: ${block.href}`];
    case "button":
      return [`${block.label}: ${block.href}`];
    case "facts":
      return [block.items.map(([l, v]) => `${l}: ${v}`).join("\n")];
    case "code":
      return [`${block.label}: ${block.value}`];
    case "table":
      return [
        [
          block.head.join(" | "),
          ...block.rows.map((row) => row.join(" | ")),
          ...block.totals.map(([l, v]) => `${l}: ${v}`),
        ].join("\n"),
      ];
    case "signoff":
      return [`${block.v}\n${block.team}`];
  }
  return [];
}

export function renderLayout(
  locale: Locale,
  subject: string,
  blocks: Block[],
  labels: {
    visit: string;
    preheader: string;
    bannerAlt: string;
    /** Shown under the emblem, as on the storefront. */
    slogan: string;
    brand: string;
    /** Staff notifications skip the artwork to keep internal mail light. */
    banner?: boolean;
    /** In-body title; the subject keeps the brand suffix for a crowded inbox. */
    heading?: string;
  },
): {
  subject: string;
  text: string;
  html: string;
  attachments: MailAttachment[];
} {
  const production = process.env.APP_ENV === "production";
  const base = (process.env.SITE_URL ?? "https://caviar.net.ua").replace(
    /\/$/,
    "",
  );
  const home = `${base}/${locale}`;
  const contact = contacts.email;
  const l = appearance.light;
  const d = appearance.dark;

  const body = blocks.map((block) => blockHtml(block, l, locale)).join("");
  const withBanner = labels.banner !== false;
  const bannerRow = withBanner
    ? `<tr><td style="padding:0;font-size:0;line-height:0"><img src="cid:${mailBannerCid}" width="${appearance.width}" alt="${escapeHtml(labels.bannerAlt)}" style="display:block;width:100%;max-width:100%;height:auto;border:0"></td></tr>`
    : "";
  const footLink = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" class="m" style="color:${l.muted};text-decoration:underline">${escapeHtml(label)}</a>`;

  // Dark-mode overrides live in a <style> block: clients that honour it swap the palette,
  // and the inline light styles remain correct everywhere else (Gmail keeps the light design).
  const style = `<style>
@media (prefers-color-scheme:dark){
  .bg{background:${d.canvas}!important}
  .card{background:${d.card}!important;border-color:${d.border}!important}
  .t,.t *{color:${d.text}!important}
  .m,.m *{color:${d.muted}!important}
  .a,.a *{color:${d.accent}!important}
  .bd{border-color:${d.border}!important}
  .zb{background:${d.zebra}!important}
  .btn{background:${d.button}!important}
  .btnt,.btnt *{color:${d.buttonText}!important}
}
@media only screen and (max-width:620px){
  .pad{padding-left:16px!important;padding-right:16px!important}
  .h1{font-size:23px!important}
  .nw{white-space:normal!important}
  .lb{width:34%!important}
  .tc{padding-left:4px!important;padding-right:4px!important;font-size:13px!important}
}
@media only screen and (max-width:400px){
  .pad{padding-left:12px!important;padding-right:12px!important}
  .tc{padding-left:2px!important;padding-right:2px!important;font-size:12px!important}
}
</style>`;

  const header = withBanner
    ? `<img src="cid:${mailLogoCid}" width="${mailLogoWidth}" height="${mailLogoHeight}" alt="${escapeHtml(labels.brand)}" style="display:block;margin:0 auto 10px;width:${mailLogoWidth}px;height:auto;border:0"><div class="a" style="${appearance.label};color:${l.accent}">${escapeHtml(labels.slogan)}</div>`
    : `<div class="a" style="font-family:${appearance.display};font-size:19px;letter-spacing:1.5px;color:${l.accent}">${escapeHtml(labels.brand)}</div>`;

  const html = `<!doctype html><html lang="${documentLanguage(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(subject)}</title>${style}</head><body class="bg" style="margin:0;padding:0;background:${l.canvas};-webkit-font-smoothing:antialiased"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(labels.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:${l.canvas}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="max-width:${appearance.width}px;margin:auto;background:${l.card};border:1px solid ${l.border};overflow:hidden"><tr><td align="center" class="pad bd" style="${cell(l, "28px 28px 22px")};border-bottom:1px solid ${l.border};text-align:center">${header}</td></tr><tr><td class="pad t" style="${cell(l, "34px 28px 26px")}"><h1 class="h1 t" style="${appearance.heading};font-family:${appearance.display};color:${l.text}">${escapeHtml(labels.heading ?? subject)}</h1>${body}</td></tr>${bannerRow}<tr><td class="pad bd m" style="${cell(l, "22px 28px 26px")};border-top:1px solid ${l.border};font-size:13px;line-height:1.9;color:${l.muted}">${footLink(home, labels.visit)}<br>${footLink(`mailto:${contact}`, contact)}<br>${contacts.phones.map((phone) => footLink(`tel:${phone.tel}`, phone.display)).join(" · ")}<br><span style="display:inline-block;padding-top:6px">${footLink(contacts.social.instagram, "Instagram")} · ${footLink(contacts.social.facebook, "Facebook")}</span></td></tr></table></td></tr></table></body></html>`;

  return {
    subject: `${production ? "" : "[TEST] "}${subject}`,
    text: [
      `${labels.brand} — ${labels.slogan}`,
      labels.heading ?? subject,
      ...blocks.flatMap(blockText),
      `${labels.visit}: ${home}`,
      `${contact} · ${contacts.phones.map((phone) => phone.display).join(" · ")}`,
      `Instagram: ${contacts.social.instagram}`,
      `Facebook: ${contacts.social.facebook}`,
    ].join("\n\n"),
    html,
    // Customer mail carries the emblem and the closing photograph; staff mail
    // carries neither, so it stays light on every single submission.
    attachments: withBanner
      ? [
          {
            filename: "caviar-berry-logo.png",
            cid: mailLogoCid,
            contentType: "image/png",
            base64: mailLogo,
          },
          {
            filename: "caviar-berry.jpg",
            cid: mailBannerCid,
            contentType: "image/jpeg",
            base64: mailBanners[locale],
          },
        ]
      : [],
  };
}
