# Engineering conventions

The rules this codebase is built on. They are not style preferences: each one
exists because breaking it caused a defect that reached a browser, an inbox or a
bill. Read the one that covers what you are about to touch.

Companion documents: `docs/admin-operations.md` (what the staff modules do and
how they are gated), `docs/release-checklist.md` (cutover), `docs/env-reference.md`
(every environment variable), `docs/hosting-and-email.md` (DNS and mail),
`docs/commerce-audit.md` (the purchase path, with file:line findings),
`docs/seo-plan.md` and `src/content/mail/README.md`.

## Stack, runtime & verification commands

- Stack: Next.js `16.4.5` (App Router), React `19.3.1`, TypeScript `5.9.3`, Tailwind CSS `4.3.4`, Firebase/Firestore, Cloudinary, mono acquiring, Nova Poshta API, HostPro SMTP.
- Keep focused components and preserve justified designer CSS in `src/styles`.
- Keep Firestore/Firebase Admin in `serverExternalPackages` in `next.config.ts` (server minification breaks protobuf `Long` constructor names).
- Standard verification commands:
  - `npm run check` (Prettier, ESLint, route types/TypeScript, unit/integration tests)
  - `npx next build --webpack` (use `--webpack`; standard Turbopack build can hang in this environment)
  - `npm run env:check` (validate env structure without printing secrets)
  - `npm run media:build -- --sources <dir>` (re-encode fixed editorial photos; see Media delivery)
- Do not trigger real mono charges, real carrier shipments, or real emails during automated tests or builds.

## Security, environments & commerce invariants

- Strictly separate `development` and `production` Vercel deployments, Firebase projects (`caviar-berry-dev` vs prod), Cloudinary folders, and SMTP credentials. Never use production credentials for local work, tests, or previews.
- Do not store contact or payment data in `localStorage`.
- Never fake order, payment, email, or subscription success:
  - Server validates authoritative prices, promo scope/expiry, and sellable stock (`quantity - reserved`) inside Firestore transactions before creating orders.
  - Online orders (`mono`): reserve stock and promo code on creation; send **no** order emails until a verified `X-Sign` webhook (or authenticated staff/receipt reconciliation) confirms payment, then consume stock/promo and enqueue customer + owner emails.
  - Bank transfer / company invoice (`transfer` / `company`): consume stock and promo code atomically on order acceptance (without marking paid) and enqueue emails immediately.
  - Nova Poshta TTNs are created manually by staff in NP's cabinet; attaching a carrier-verified 14-digit TTN to a paid packed order sends one deduplicated email ("prepared", not handed over). Changing fulfillment status to shipped is a separate manual action.
  - Batch expiry dates in staff inventory are advisory reminders only; they are never shown to customers and do not block sales.
  - Mail jobs run via `after()` and `/api/internal/reconcile`. Never auto-retry ambiguous SMTP `accepted` outcomes or ambiguous payment invoices.
- Protect public forms with server validation, rate limits, origin checks, honeypot fields, and idempotency keys.

## Language, localization & UX rules

- Explain important implementation decisions briefly in Ukrainian during work: why a boundary exists, what it protects, and relevant tradeoffs.
- Code comments: concise English only, at non-obvious points.
- Storefront is bilingual (`ua`/`en`). All customer-facing copy, alt text, and tooltips must come from `src/i18n` dictionaries or bilingual catalog fields. Keep staff UI in Ukrainian and product content bilingual with editable SEO fields + automatic fallback.
- Legal copy is unified in `src/content/legal/offer.json` and rendered at `/ua/offer` and `/en/offer` (`#privacy` jumps to section 12; legacy `/privacy` and `/terms` redirect permanently). Never rewrite client-approved legal text without explicit instruction.
- Accessible states: provide accessible `404`/error/loading states; `404` may use a cancellable countdown to the last valid internal page; never auto-dismiss checkout errors or lose form data.
- Before closing any UI task, walk through it as a customer/staff user, including invalid input and service failure:
  - Place field errors directly below the affected input (before the submit button if on a separate row) and associate them via `aria-invalid` / `aria-describedby`.
  - Place request/service failures at form level, retain entered values, and show one clear message per issue.
  - Remove files, routes, or fields only after checking all callers and persisted Firestore/media references.

## Regression checks, design fidelity & Safari rules

- Before editing, trace affected behavior across callers, shared components/styles, Firestore projections, routes, integrations, and env config.
- Make the smallest complete fix and verify the target flow plus neighboring consumers across both locales (`ua`/`en`), relevant viewports (`393`, `768`, `834`, `1024` in both orientations, `1440`, `1920` px), and interaction states. Portrait tablets up to `1180` px (the desktop navigation breakpoint) use the aspect-ratio split layout, not the full-height one; `1024` portrait is the case that regressed before, so check it explicitly. A build pass alone does not verify UI or runtime behavior — but CSS Modules `composes` across files only fails at build time, so run `npx next build --webpack` after touching it.
- Reproduce before diagnosing, and verify the diagnosis before fixing. Two hypotheses this project has already disproved by experiment: a mail layout overflowing because of an `<img>` (it was the items table), and a staff session dropping because the cookie lacked `maxAge` (it was set; the duration had simply elapsed). A wrong fix to a real symptom costs more than the extra check.
- Known dev-only console noise — do not spend time on it: `This library called use() to suspend…` on a locale switch is Next.js's own `InnerLayoutRouter` suspending on an unprefetched RSC payload (no frame of our code), and the message exists only in React's development build. Confirm against `npx next build --webpack` + `next start` before treating any console warning as a product bug.
- `SessionSplash`'s bootstrap belongs to the initial document only. It must stay a parse-time inline script rendered once (`SplashBootstrap` guards re-mounts); `next/script` defers it and reintroduces a splash flash.
- Storefront visual/motion target is at least 95% fidelity to the approved HTML prototypes (`index.html`, `index-en.html`, held by the project owner), **respecting approved deviations in `docs/design-review.md`**:
  - On iOS WebKit and macOS Safari (`:root.safari-photo-safe`, plus the `@supports (-webkit-touch-callout: none)` fallback), still editorial photos disable `sepia` filters, grain/toning pseudo-layers and the decoded-photo fade. Hero keeps its fixed media on Safari and iOS — only its grain layer and filter are disabled. Verified in WebKit on iPhone, iPad and desktop Safari. Do not re-enable the disabled effects, and do not "fix" Hero's fixed positioning on the assumption that Safari cannot do it.
  - Preserve the mobile (`<= 640 px`) fixed bottom purchase bar on product pages/modals with `ResizeObserver` spacer reservation.
- For staff pages, start from `docs/admin-operations.md` and reuse established primitives (`CatalogGroup`, `CatalogImageField`, `CatalogText`, `StaffHelp`, `StaffIcon`, `StaffRecord`, `AdminSectionTabs`, `StaffPagination`, `StatusBadge`, `StaffSelect`, `AdminLink`, `StaffBusy`, plus `catalog.module.css` for `group`/`field`/`controls`/`primary`/`button`/`modal`). Keep module mutations at their own server boundaries.

### Admin UI conventions

Goal is one set of primitives everywhere, not a redesign. Never invent a new badge, colour or spacing scale.

- **One badge: `StatusBadge`.** Either `kind` + `value` (the scale resolves the tone) or `tone` directly for a derived condition that is not a stored status. No bespoke coloured `<span>`.
- **Tones carry meaning, not mood:** `new` nobody picked it up (strongest accent), `active` in progress, `transit` moving to done, `done` neutral and needs no attention, `problem` terracotta, `closed` grey.
- **Statuses and categories are different.** Do not force a category (customer segment, inquiry source) onto the status scale — one shared tone makes them indistinguishable and reads worse. Give them their own hue inside the warm family; there are no cold colours in the admin.
- **Accent follows importance.** Main action `primary`; a secondary cross-module jump is a plain smaller link; service fields `muted`.
- **No raw database fields in the UI.** Every value gets a label; show a technical identifier only when staff genuinely need it.
- **Links never live inside `<dl>`** — a definition list is for label/value pairs only.
- **Cross-module jumps open in a new tab** (`target="_blank"` + `rel="noopener noreferrer"`) so the current record stays open. `AdminLink` deliberately does not intercept those.
- **No dead controls.** Hide what is unimplemented or mark it unavailable; an unexplained inert button is worse than none.
- **A field error never sits inside a row of controls.** `StaffFieldError` is always mounted and reserves a line, so a field that owns one is taller than the select or button beside it and the row reads as misaligned — this defect has recurred several times. Compose `fieldRow` from `staff.module.css`: it bottom-aligns the controls and puts any error on the row's own last line. The one exception is `customers.module.css`, where the filter row keeps the error inside the search field and compensates its neighbours with an explicit `margin-block-end`; do not copy that pattern into new code.
- **One confirmation dialog: `StaffConfirm`.** Anything that cannot be undone, archives a record, publishes to the storefront, or sends a message to a customer states its consequence before it runs. Never `window.confirm`, never a hand-rolled `<dialog>`.
- **Record values must be copyable without their labels.** `StaffFacts`/`StaffFact` put the label above the value and expose a copy control, because staff paste addresses, phones and waybills into the carrier cabinet and the banking app. Use `weight` to carry importance: `lead` for the figure the record is about, `strong` for data staff act on, `dim` for identifiers and timestamps.
- **Long explanations live in a `StaffHelp` tooltip**, not in the layout. Visible text is what is needed on every visit; everything else goes behind «i» or into `/admin/settings/help`.
- **`composes` instead of copied CSS.** Need the same geometry — compose the shared class, never duplicate the rules.
- Staff UI stays Ukrainian; product content stays bilingual.

## Media delivery

- Three delivery paths, deliberately separate. Do not merge them or move a photo between them without a reason stated in the session log.
  - `Photo` (`next/image`) for catalogue, staff-managed and most editorial images. Dimensions come from `src/content/image-sizes.json`; Cloudinary URLs resolve bundled backups through `src/content/bundled-catalog-media.json`.
  - `EditorialPhoto` for the fixed, art-directed photographs where texture is the product (Hero, split sections). It renders `<picture>` straight from `public/assets/img/editorial-set`, past the image optimizer.
  - `catalog-set` for the fixed catalogue cards (jar body, lid, serving photo). Pre-encoded by `npm run media:catalog`, served straight from `public/`. Measured: a cold optimizer cost a median 139 ms per card image against 13 ms static, about 92% of the wait being the transform. `Photo` picks this path automatically when `src` resolves to a key in `src/content/catalog-media.json`; anything else still goes through `next/image`, so a staff-replaced image keeps working.
- `scripts/build-catalog-media.ts --masters <dir>` re-encodes from the lossless mockup exports. The jar body is a ring of tin around the roe: the master holds the roe alone, so it is fitted inside the detected rim rather than stretched over the disc, and a serving photo whose aspect does not match the shipped crop is refused rather than silently re-cropped. WebP only — AVIF measured as smoothing the roe grain at a larger file.
- Never route an `editorial-set` or `catalog-set` asset through `next/image`. Those files are already encoded once at the calibrated quality; a second lossy pass measurably flattens caviar grain, which is the exact defect this path exists to prevent.
- Regenerate with `npm run media:build -- --sources <dir>`. The photographer's originals live outside the repository; the generated derivatives and `src/content/editorial-media.json` are committed. Encoder settings in `scripts/build-editorial-media.ts` were calibrated by measuring high-frequency energy against the originals — change them only with a new measurement, not by eye.
- Art-direction crops are expressed as normalised rectangles over the source frame and chosen so the product (a jar, a spoon, a labelled lid) survives every container aspect. Containers must not crop the subject: if a breakpoint needs a different framing, add a variant rather than letting `object-fit` cut it.
- Generated filenames carry a content digest, so `next.config.ts` serves that directory as `immutable`. Keep the digest if you touch the script; without it the long cache would serve stale photos.
- Preload only the preferred format per art-direction condition. Preloading several formats makes browsers that support all of them download all of them.

## Infrastructure budget

- The client wants to stay inside free infrastructure tiers where possible, while staying ready to scale. Treat metered resources as a design constraint, not an afterthought, and say in the session log when a change moves the needle.
- What costs quota here: host image-optimization transformations, egress bandwidth, serverless invocations and duration, Firestore document reads/writes, Cloudinary transformations and storage, and cron frequency. Static files under `public/` are served without transformation and consume no image-optimization quota — that is part of why fixed editorial photos are pre-encoded.
- Prefer, in order: a static asset, a cached server render, a cached Firestore read, then an uncached read. Reuse cache tags already defined in `src/lib/server/catalog` instead of adding new uncached queries.
- Keep the reconciliation cron at its current daily schedule unless asked; more frequent crons are a paid feature on the free plan and the job is designed to be idempotent, not timely.
- Scaling levers, if a limit is hit: raise cache TTLs, move more fixed media to pre-encoded static assets, narrow Firestore projections, and batch staff queries. Reach for a paid tier only after these, and flag it rather than deciding alone.

## SEO, email templates & hosting cutover guardrails

- Technical SEO: ensure `dev-caviar-berry.vercel.app` and preview deployments stay `noindex`; enable indexing only on production `SITE_URL=https://caviar.net.ua`. Keep `canonical` and `hreflang` (`ua`, `en`, `x-default`) free of UTM/query parameters, and exclude hidden/archived products and `checkout-test` (`TEST_PRODUCT_ENABLED`) from `sitemap.ts` and `Product`/`Offer` JSON-LD.
- Transactional emails (`src/content/mail/`): table-based HTML with inline CSS (`appearance.json`), system fonts, escaped user-supplied values, synchronized plain-text bodies. Compose bodies from the block model in `src/lib/server/mail/layout.ts` (`p`/`lead`/`facts`/`table`/`button`/`note`/`signoff`) so HTML and text are generated from the same data and cannot drift — do not hand-write mail HTML.
- **External images stay forbidden**; the brand banner is embedded as a CID attachment from `src/content/mail/banners.ts` (both locales re-encoded together). Remote images are blocked by default in most clients and leak a read signal. Staff/owner mail carries no banner at all and stays short — it is sent on every submission. A test asserts both rules.
- Mail identity lives in the environment, never in code: `MAIL_FROM` must equal `SMTP_USER`, and production refuses the DEV mailbox. `MAIL_REPLY_TO` is the mailbox a human reads. Public contact details (email, phones, socials) come from `src/content/contacts.ts` — the single source for storefront and mail alike. `src/content/legal/` keeps its own literal contacts: that text is client-approved.
- Domain cutover (`docs/hosting-and-email.md`): never point root `A` to Vercel until `MX` and `mail.caviar.net.ua` are decoupled from the root `A` record and SPF/DKIM/DMARC are verified with HostPro.

## Maintainable project structure

- Keep route entry points focused on routing, authentication, input validation, and cache invalidation. Keep domain rules pure in `src/domain` without React, Next.js, or Firestore dependencies.
- Put server queries, form parsing, and transactional writes in their owning modules (`src/lib/server/catalog`, `src/lib/server/orders`, etc.).
- Keep fixed storefront media in `public/assets` and staff-managed uploads in Cloudinary; keep `src/content/bundled-catalog-media.json` aligned before moving or deleting bundled media. `public/assets/img/editorial-set` and `src/content/editorial-media.json` are generated — edit the recipe in `scripts/build-editorial-media.ts` and rebuild, never the output. Keep Next.js metadata convention files in `src/app`.
