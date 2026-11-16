# Caviar Berry

Bilingual (`ua`/`en`) storefront and staff back office for a Ukrainian sturgeon farm, on the
Next.js App Router. The storefront is statically generated; the back office is a server-rendered
area behind Google sign-in. Commerce is authoritative on the server: prices, promotion scope and
sellable stock are recomputed inside Firestore transactions, never trusted from the client.

## Stack

Next.js `16.4.5` · React `19.3.1` · TypeScript `5.9.3` · Tailwind CSS `4.3.4` ·
Firebase Admin + Firestore · nodemailer · Playwright `1.65` · ESLint `9.39` · Prettier `3.9`.

Node `>=24 <27` (Node 24 in CI), npm `>=11`. Exact installed versions: `package-lock.json`.

No UI framework, no data-fetching library, no ORM, no state manager — the only runtime
dependencies are `next`, `react`, `react-dom`, `firebase`, `firebase-admin` and `nodemailer`.

## Getting started

```bash
npm install
cp .env.example .env.local     # every variable is documented in that file
npm run dev                    # http://localhost:3000
```

The storefront runs without any service configured. Checkout, mail, payments and the admin each
switch on only when their own variables are present, and fail closed otherwise — so a fresh
clone is usable before any credentials exist.

## Commands

| Command                                  | What it does                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`                            | Development server.                                                                                         |
| `npm run check`                          | Prettier, ESLint, route types, TypeScript, unit tests. The gate before any commit.                          |
| `npx next build --webpack`               | Production build. **Use `--webpack`** — the default Turbopack build can hang in this project.               |
| `npm start`                              | Serves the production build.                                                                                |
| `npm run test:e2e`                       | Playwright across viewports, locales, Chromium/Firefox/WebKit.                                              |
| `npm run env:check`                      | Validates environment structure without printing secrets. Add `-- --production` for the production ruleset. |
| `npm run media:build -- --sources <dir>` | Re-encodes the fixed editorial photography. Output is committed.                                            |
| `npm run social:build`                   | Regenerates the 1200×630 link preview and the Apple touch icon. Output is committed.                        |

Environment variables are not listed here on purpose: `.env.example` and
`.env.production.example` are the registry, and `npm run env:check` is the validator.

## Layout

```
src/
  app/
    [locale]/          storefront, statically generated per locale
    (staff)/admin/     back office, server-rendered behind Google sign-in
    api/               checkout, inquiries, payment webhook, delivery, cron
    sitemap.ts robots.ts manifest.ts llms.txt/   metadata routes
  domain/              pure business rules — no React, Next or Firestore
  lib/server/          Firestore queries, transactional writes, mail, payments, delivery
  lib/                 shared helpers (metadata, money formatting, catalogue fixtures)
  components/
    sections/          home-page blocks
    store/             storefront behaviour (cart, checkout, overlays)
    staff/             admin primitives (StatusBadge, StaffConfirm, StaffFacts, …)
    ui/ seo/           shared presentation, structured data
  content/             editable content: products, journal, legal offer, mail templates, contacts
  i18n/                ua/en storefront dictionaries, Ukrainian staff copy
  styles/              designer CSS kept deliberately hand-written
scripts/               build-time generators and environment checks
tests/unit/            node:test over the domain and server modules, in-memory Firestore
tests/e2e/             Playwright specs
```

`src/domain` is the layer to read first: order lifecycle, stock arithmetic, promotion rules,
checkout validation, structured data and acquisition attribution all live there as pure
functions, which is why most of the test suite needs no database.

## Infrastructure

| Service           | Role                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firestore**     | Orders, customers, inquiries, catalogue, promotions, staff team, mail queue. Separate development and production projects; the order book and staff team are additionally scoped by `APP_ENV`. |
| **Firebase Auth** | Google sign-in for the back office. The only client-side Firebase usage; `firestore.rules` denies all direct client access because every read goes through our own server routes.              |
| **Cloudinary**    | Images uploaded through the admin. Fixed editorial photography is **not** here — it is pre-encoded into `public/assets`.                                                                       |
| **Vercel**        | Hosting for both environments and the daily reconciliation cron (`vercel.json`).                                                                                                               |
| **HostPro**       | Domain, mailboxes and SMTP. Mail stays on this host after the web records move to Vercel.                                                                                                      |
| **mono (Plata)**  | Card acquiring. Payment state changes only on a signature-verified webhook or an authenticated status read.                                                                                    |
| **Nova Poshta**   | City/branch/street directory during checkout, and an advisory waybill lookup. Labels are created by staff in the carrier's own cabinet.                                                        |

## Things that will surprise you

- **Build with `--webpack`.** The Turbopack production build can hang here.
- **Firestore stays external to the bundle** (`serverExternalPackages` in `next.config.ts`):
  server minification breaks protobuf's `Long` constructor names.
- **Fixed editorial photos bypass the image optimizer.** They are encoded once by
  `scripts/build-editorial-media.ts` into `public/assets/img/editorial-set` with content-digest
  filenames served `immutable`. A second lossy pass measurably flattens caviar grain, so never
  route them through `next/image`.
- **The storefront is static; the admin invalidates it by cache tag.** Saving the catalogue
  refreshes both the data cache and the affected routes, including `sitemap.xml`.
- **Admin access is data, not configuration.** `ADMIN_ALLOWED_EMAILS` bootstraps permanent
  superadmins; the rest of the team lives in Firestore and is managed at
  `/admin/settings/team`. Roles restrict access: a manager cannot reach products, inventory or
  promotions — the pages refuse and the sidebar does not offer them (`managesCatalog`).
- **Money and stock never move optimistically.** Online orders reserve stock and go silent until
  a verified payment; bank-transfer and invoice orders consume stock on acceptance without being
  marked paid. Mail is a durable, deduplicated queue — an ambiguous SMTP outcome is never
  retried automatically.
- **`firestore.rules` and `firestore.indexes.json` are deployed separately** from the app. New
  queries need their index pushed before the feature works in production.

## Further reading

Mail triggers and templates: `src/content/mail/README.md`.

Operating notes — the release checklist, the hosting and mail setup, the commerce
audit and what is deliberately deferred past launch — are kept outside this
repository and handed over separately. They describe infrastructure rather than
code, so they do not belong in a public tree.
