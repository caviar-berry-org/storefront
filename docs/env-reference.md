# Реєстр змінних середовища

Оновлено 2026-11-13. Секретні значення тут **не наводяться** — лише факт наявності. Реальні значення: локально `.env.local` / `.env.production`, у хмарі — Vercel → Project → Settings → Environment Variables.

Перевірка: `npm run env:check` (dev) і `npm run env:check -- --production` (prod).

Умовні позначення: `<секрет>` — не виносити в документи; `—` — не задано.

---

## 1. Середовище та домен

| Змінна       | DEV                     | PROD                    | Коментар                                                                         |
| ------------ | ----------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `APP_ENV`    | `development`           | `production`            | Головний перемикач. Керує гейтами пошти, оплат, індексації. **Не** `VERCEL_ENV`. |
| `SITE_URL`   | `http://localhost:3000` | `https://caviar.net.ua` | Абсолютні URL у листах, canonical, sitemap. Без слеша в кінці.                   |
| `VERCEL_ENV` | ставить Vercel          | ставить Vercel          | Читається лише для перевірок. Руками не задавати.                                |
| `NODE_ENV`   | ставить Next.js         | ставить Next.js         | Руками не задавати.                                                              |

## 2. Firebase / Firestore

| Змінна                    | DEV                                | PROD                                | Коментар                                                                                                                        |
| ------------------------- | ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`     | `caviar-berry-dev`                 | `caviar-berry-prod`                 | Проєкти строго розділені.                                                                                                       |
| `FIREBASE_CLIENT_EMAIL`   | `…@caviar-berry-dev.iam…`          | `…@caviar-berry-prod.iam…`          | Має належати своєму `PROJECT_ID` — це перевіряє `env:check`.                                                                    |
| `FIREBASE_PRIVATE_KEY`    | `<секрет>`                         | `<секрет>`                          | RSA PEM. Переноси рядків як `\n`.                                                                                               |
| `FIREBASE_WEB_API_KEY`    | `<секрет>`                         | `<секрет>`                          | Вхід персоналу через Google.                                                                                                    |
| `FIREBASE_AUTH_DOMAIN`    | `caviar-berry-dev.firebaseapp.com` | `caviar-berry-prod.firebaseapp.com` |                                                                                                                                 |
| `ADMIN_ALLOWED_EMAILS`    | `kotlyaranya1771@gmail.com`        | **доповнити**                       | Через кому. Постійні суперадміни: доступ є завжди, з адмінки їх не прибрати. Решту команди запрошують у `/admin/settings/team`. |
| `FIRESTORE_EMULATOR_HOST` | —                                  | —                                   | Лише для локальних тестів з емулятором.                                                                                         |

## 3. Каталог і медіа

| Змінна                  | DEV         | PROD                | Коментар                                                                   |
| ----------------------- | ----------- | ------------------- | -------------------------------------------------------------------------- |
| `CATALOG_SOURCE`        | `firestore` | `firestore`         | `firestore` = товари з адмінки. Якщо не задано — статичні фікстури з репо. |
| `CLOUDINARY_CLOUD_NAME` | `dv10ghdyb` | `caviar-berry-prod` | Окремі акаунти/теки для dev і prod.                                        |
| `CLOUDINARY_API_KEY`    | `<секрет>`  | `<секрет>`          |                                                                            |
| `CLOUDINARY_API_SECRET` | `<секрет>`  | `<секрет>`          |                                                                            |
| `EDITORIAL_SOURCES`     | —           | —                   | Лише для `npm run media:build`, у рантаймі не потрібна.                    |

## 4. Пошта

| Змінна                      | DEV                         | PROD                                          | Коментар                                                                                           |
| --------------------------- | --------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`                 | `caviar.net.ua`             | **`mail.caviar.net.ua`**                      | ⚠️ Змінити **до** переведення домену на Vercel, інакше SMTP відвалиться разом з A-записом.         |
| `SMTP_PORT`                 | `465`                       | `465`                                         | Інше значення транспорт відхиляє.                                                                  |
| `SMTP_SECURE`               | `true`                      | `true`                                        | Інше значення транспорт відхиляє.                                                                  |
| `SMTP_USER`                 | `dev-notify@caviar.net.ua`  | **`notify@caviar.net.ua`**                    | Нову скриньку створити в cPanel. Прод свідомо **відмовляється** слати з dev-скриньки.              |
| `SMTP_PASSWORD`             | `<секрет>`                  | `<секрет>`                                    | Пароль скриньки = доступ і на читання, тому окрема скринька, а не `sale@`.                         |
| `MAIL_FROM`                 | `dev-notify@caviar.net.ua`  | **`notify@caviar.net.ua`**                    | **Мусить дорівнювати `SMTP_USER`** — інакше `CONFIGURATION`.                                       |
| `MAIL_REPLY_TO`             | —                           | **`sale@caviar.net.ua`**                      | Куди відповідає клієнт. Якщо не задано: у проді падає на `sale@`, у DEV — на відправника.          |
| `MAIL_TEST_RECIPIENTS`      | `kotlyaranya1771@gmail.com` | своя адреса                                   | Білий список для `npm run mail:test`.                                                              |
| `OWNER_NOTIFICATION_EMAILS` | `kotlyaranya1771@gmail.com` | **`sales@faic.com.ua,faic.caviar@gmail.com`** | Через кому, кожен отримує окрему копію. Лист працівникам піде **тільки** на адресу з цього списку. |
| `OWNER_EMAIL_ENABLED`       | `true`                      | `true`                                        | Сповіщення працівникам.                                                                            |
| `ORDER_EMAIL_ENABLED`       | `true`                      | `true`                                        | Листи клієнтам про замовлення.                                                                     |
| `RESTOCK_EMAIL_ENABLED`     | `true`                      | `true`                                        | Листи про появу товару.                                                                            |
| `PROMOTION_EMAIL_ENABLED`   | `true`                      | `true`                                        | Видача промокодів узагалі.                                                                         |
| `PROMOTION_PUBLIC_ENABLED`  | `true`                      | `true`                                        | ⚠️ `true` = попап приймає **будь-яку** адресу. `false` = лише `MAIL_TEST_RECIPIENTS`.              |

## 5. Оплата і доставка

| Змінна                               | DEV        | PROD                         | Коментар                                                                           |
| ------------------------------------ | ---------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| `CHECKOUT_ENABLED`                   | `true`     | **`true`** (зараз не задано) | Без неї оформлення вимкнене.                                                       |
| `MONO_TOKEN`                         | `<секрет>` | `<секрет>`                   | Різні токени для dev і prod.                                                       |
| `MONO_MODE`                          | `live`     | `live`                       | ⚠️ У DEV теж `live` — **списуються справжні гроші**. Автотести платежів не ганяти. |
| `ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT` | `true`     | `false`                      | Свідомий дозвіл на реальні оплати в DEV.                                           |
| `NOVA_POSHTA_API_KEY`                | `<секрет>` | `<секрет>`                   | Довідник міст і відділень.                                                         |
| `CRON_SECRET`                        | `<секрет>` | `<секрет>`                   | Bearer для `/api/internal/reconcile`. Мінімум 32 випадкові символи.                |

## 6. Прапорці релізу

| Змінна                 | DEV                    | PROD        | Коментар                                                                                |
| ---------------------- | ---------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `TEST_PRODUCT_ENABLED` | — (у DEV видно завжди) | **`false`** | `checkout-test` має бути прихований у проді: не в каталозі, не в sitemap, не в JSON-LD. |

---

## Чого бракує в `.env.production` станом на 13.11

`CHECKOUT_ENABLED`, `MONO_MODE`, `ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT`, `ORDER_EMAIL_ENABLED`, `OWNER_EMAIL_ENABLED`, `OWNER_NOTIFICATION_EMAILS`, `RESTOCK_EMAIL_ENABLED`, `MAIL_TEST_RECIPIENTS`, `CRON_SECRET`, `TEST_PRODUCT_ENABLED`.

Плюс три, які `npm run env:check -- --production` зараз називає помилками: `SMTP_USER`/`MAIL_FROM` досі dev-скринька, `SMTP_HOST` прив'язаний до кореневого домену, `MAIL_REPLY_TO` не задано.
