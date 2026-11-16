# caviar.net.ua — перехід сайту на Vercel і пошта

**Оновлення 12.11:** чинний поштовий контракт, усі змінні й умови деплою описані в [admin-operations.md](admin-operations.md) та [README шаблонів](../src/content/mail/README.md). Це замінює ранні обмеження нижче: `ORDER_EMAIL_ENABLED` дозволяє листи клієнтам у DEV, `OWNER_EMAIL_ENABLED` — копії налаштованим власникам, `RESTOCK_EMAIL_ENABLED` — наявність конкретного фасування. Діагностичний `mail:test` залишається allowlisted. Нові промокоди діють 90 днів. Реальну доставку після цього деплою перевіряє Анна; у поточній кодовій перевірці листи не надсилалися.

Дослідження від 8 листопада 2026 року. Основний домен нового магазину — `caviar.net.ua`. План передбачає збереження реєстрації та DNS у поточного провайдера, корпоративних скриньок на HostPro і підключення вебсайту до production-проєкту Vercel. Налаштування провайдерів не змінювали.

## Поточний стан

| Об’єкт               | Що підтверджено                                                                                                                                                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Домен і DNS          | Публічні NS — `master.hostsila.com`, `slave.hostsila.net`, `slave2.hostsila.com`, `slave3.hostsila.net`. Записи редагувати в авторитетній зоні. Публічний DNS збігається з ключовими записами зі скриншота cPanel.                                                                                                                                         |
| Вебсайт              | Кореневий A — `91.239.232.33`, `www` — CNAME на корінь. Старий сайт відповів по HTTPS і перенаправив на `/uk/` через Polylang. Окремого перенаправлення `/uk` → `/ua` не плануємо. Для `/uk` та інших невідомих адрес використовуємо HTTP 404 із загальним відліком повернення. Окремий маршрут чи постійне перенаправлення для старої локалі не потрібні. |
| Пошта                | cPanel показує три поштові скриньки. Публічний MX для кореня — `0 caviar.net.ua.`. `mail` — CNAME на корінь. `webmail` має окремий A на `91.239.232.33`. Отримання та надсилання листів через реальні скриньки не тестували.                                                                                                                               |
| Автентифікація пошти | SPF кореня — `v=spf1 +a +mx +ip4:91.239.232.33 ~all`. DMARC — `p=none`. Зона cPanel показує DKIM і службові записи пошти. Установлені значення та справжні заголовки тестових листів звірити перед перемиканням.                                                                                                                                           |
| Інші записи          | Для кореня у публічній перевірці не було AAAA чи CAA. cPanel показує `static` як окремий домен, але в публічній перевірці немає A для самого `static.caviar.net.ua`. Перед прибиранням старого хостингу з’ясувати, що там і на службових піддоменах ще використовується.                                                                                   |
| Підписка HostPro     | На скриншоті активний хостинг із автоподовженням, на ньому є WordPress, скриньки й webmail. До відмови від хостингу треба підтвердити у HostPro, що стане зі скриньками, історією, піддоменами й авторитетною DNS-зоною. Реєстрація домену та хостинг — окремі послуги.                                                                                    |

**Критична залежність.** Сьогодні MX та клієнтський `mail` залежать від кореневого A. Якщо перемкнути лише A на Vercel, зовнішні сервери можуть надсилати вхідну пошту на Vercel, а поштові клієнти — підключатися до нього замість HostPro. Поштовий hostname і MX треба відокремити заздалегідь. MX має вказувати на hostname з власним A/AAAA, а не на CNAME. [RFC 2181](https://www.rfc-editor.org/rfc/rfc2181.html#section-10.3) · [cPanel Email Routing](https://docs.cpanel.net/cpanel/email/email-routing/)

## Порядок перемикання

1. Зберегти DNS-зону з типами, цілями, пріоритетами й TTL. Узгодити контрольовану резервну копію WordPress, бази, скриньок і важливих пересилань. Перевірити доступ до DNS і резервів, а також що буде зі скриньками після завершення тарифу. Робоча копія плану не потребує паролів чи Support PIN. Перед подальшим поширенням скриншотів приховати Support PIN та дані доступу.
2. У HostPro підтвердити підтримуваний MX hostname, IP поштового сервера, SMTP hostname для TLS і можливість тримати локальну пошту, коли сайт на зовнішньому A. Типовий варіант для цієї зони після підтвердження — змінити `mail.caviar.net.ua` з CNAME на A поштового сервера, а MX кореня спрямувати на `mail.caviar.net.ua.`. Підійде й інший окремий hostname, який прямо надасть HostPro. Поштовий hostname підготувати й перевірити раніше, ніж змінювати MX. Переконатися, що в cPanel домен продовжує приймати пошту локально.
3. Попросити HostPro перевірити SPF після відокремлення, бо механізм `a` перевіряє адреси кореневого домену, які зміняться на Vercel. Залишити один SPF TXT для кожного hostname, зберегти чинні DKIM, DMARC, webmail та інші потрібні записи. Звірити SRV й налаштування поштових клієнтів на випадок, якщо вони використовують кореневий hostname. За можливості знизити TTL заздалегідь. Публічні записи мали TTL 14 400 секунд, тобто чотири години. Дати старим кешам MX і `mail` сплинути перед зміною веб-A. Перевірити вхідні й вихідні листи на зовнішніх скриньках і справжніх клієнтах. [SPF RFC 7208](https://www.rfc-editor.org/rfc/rfc7208.html) · [HostPro SMTP/IMAP](https://billing.hostpro.ua/index.php?rp=/knowledgebase/286/Nastroika-pochtov%D1%8Bkh-klyentov.html)
4. На Vercel відкрити Domains саме production-проєкту, підготувати `caviar.net.ua` та `www.caviar.net.ua`, якщо потрібне перенаправлення `www` на корінь. Використовувати A/CNAME і TXT для підтвердження, які покаже цей проєкт. Усі зміни записів внести в поточну авторитетну зону. Перенесення реєстрації та зміна NS для цього не потрібні. Окремо підтвердити тариф для комерційного магазину. [Домен Vercel](https://vercel.com/docs/domains/set-up-custom-domain) · [Vercel Hobby](https://vercel.com/docs/plans/hobby)
5. У вікно перемикання оновити лише вебзаписи кореня та `www` відповідно до Vercel. Перевірити TLS на обох адресах, обидві локалі, кореневий маршрут, 404, canonical/sitemap і `SITE_URL=https://caviar.net.ua`. Для Google staff sign-in звірити Firebase Authorized domains та дозволений origin сесії. Перевірити інтеграційні адреси webhook після підключення сервісів. Старий сертифікат WordPress не переноситься на Vercel. Точний строк його чинності у цьому дослідженні незалежно не підтверджено. [SSL Vercel](https://vercel.com/docs/domains/working-with-ssl)
6. Повторити зовнішні тести пошти та webmail після перемикання. Для відкату сайту зберегти попередні A/CNAME і доступ до WordPress. Поштовий MX після успішного відокремлення лишається на поштовому сервері. Перед відключенням HostPro окремо вирішити долю пошти, даних, старих сервісів і DNS.

## Як надсилати автоматичні листи

### Безпечний початок на чинному HostPro

**Перший етап завершено 11 листопада.** Клієнт підтвердив одержання коду по одному разу на різні адреси з локального сервера. Пряме неавторизоване читання існуючої видачі повертає 403; фактичні DEV-правила Firestore забороняють усі клієнтські read/write. Деплой виконує користувач; підключення саме з Vercel лишається наступною перевіркою. Потрібні обидва прапорці `PROMOTION_EMAIL_ENABLED=true` та `PROMOTION_PUBLIC_ENABLED=true` у DEV-проєкті зі своїми DEV-обліковими даними. Адмінка й фінансове використання коду — наступні етапи.

Початковий обсяг: лист із реально виданим промокодом і підтвердження збереженого замовлення. Інші статуси замовлення — наступний етап; нагадування та маркетингові розсилки потребують окремого погодження. Підтвердження замовлення не означає підтвердження онлайн-оплати.

Для початкового SMTP-підключення не перемикаємо домен сайту й не редагуємо наявні A, CNAME, MX, NS, SPF, DKIM або DMARC. Зберігаємо копію поточної зони. Створюємо окрему DEV-скриньку (наприклад, `dev-notify@caviar.net.ua`) через Email Accounts; чинні скриньки та налаштування старого сайту лишаються робочими. Точний TLS hostname і порт беремо з Connect Devices, а можливість зовнішнього SMTP та ліміти підтверджуємо у HostPro. Email Deliverability спочатку лише перевіряємо: автоматичний Repair без розбору поточних записів не застосовуємо.

11 листопада створено `dev-notify@caviar.net.ua`. Connect Devices підтвердив `caviar.net.ua:465`, SSL/TLS й автентифікацію повною адресою. `npm run mail:verify` успішно перевірив TLS/вхід. `npm run mail:test` надіслав один TEST-лист, а реальний сабміт попапа — один лист із кодом; клієнт підтвердив отримання обох у Вхідних. Повтори через футер UA/EN не надсилають дубля. Пароль лишається локально поза Git, сертифікат перевіряється, таймаути обмежені; секрети й сирі SMTP-відповіді не логуються. Заголовки SPF/DKIM/DMARC незалежно ще не перевіряли, підключення саме з Vercel — після деплою користувачем. SMTP hostname залежить від веб-A, перед майбутнім перемиканням сайту його треба замінити на незалежний поштовий hostname HostPro.

Користувач явно погодив публічну DEV-видачу: `PROMOTION_EMAIL_ENABLED=true` та `PROMOTION_PUBLIC_ENABLED=true` дозволяють формі приймати будь-яку валідну адресу; одна нормалізована адреса — одна видача й один прийнятий SMTP лист із кодом. CLI-діагностика надалі використовує лише `MAIL_TEST_RECIPIENTS`. Локальні прапорці ввімкнено; у Vercel їх потрібно встановити в окремому DEV-проєкті й передеплоїти. Його основний деплой може мати `VERCEL_ENV=production`: перевіряємо власний `APP_ENV=development`, DEV Firebase та DEV-скриньку. Реальний production лишається вимкненим. Технічний бюджет — 20 спроб/годину, Origin/поле-пастка, максимум три безпечні спроби на видачу з паузою 60 секунд. Строк дії не погоджений, `expiresAt: null`; шаблон UA/EN тимчасовий, позначений TEST. Права прямого клієнтського читання нових колекцій перевірити перед відкритим доступом.

DEV-відправку обмежуємо явним списком контрольованих адресатів і малим обсягом. Окремий пароль зберігаємо лише в серверному середовищі DEV, окремо від production. Перевіряємо доставку на Gmail/Outlook, заголовки SPF/DKIM/DMARC, відповіді й повідомлення про недоставку. Скриньки одного домену можуть ділити квоту та репутацію відправника; окрема скринька не ізолює ці ризики повністю. Вимкнення відправки в новому застосунку не потребує зміни старого сайту або DNS.

Підключений SMTP сам собою не робить оформлення замовлення готовим: лист запускається лише після авторитетного запису замовлення, з перевіркою ціни та залишків. Недоступність пошти не скасовує вже збережене замовлення; доставка має окремий стан і контроль повторів без дублювання.

Корпоративна скринька приймає відповіді. Транзакційний відправник відправляє промокод, підтвердження замовлення чи оплати, статус відправлення і повідомлення про наявність. У застосунку з’явиться серверний виклик сервісу після відповідної події. Для старту не потрібен власний поштовий сервер або локальний `sendmail`.

| Варіант                                      | Налаштування і перевірка                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Транзакційний HTTP API, запасний варіант** | Наприклад, Resend у кабінеті клієнта. Перевірити окремий піддомен на кшталт `notify.caviar.net.ua`. У поточній DNS-зоні додати записи, які видасть провайдер, зокрема SPF/DKIM і за потреби MX для технічного піддомену повернень. Кореневий MX для корпоративної пошти лишається окремим. У Vercel додати серверний API-ключ і налаштування відправника. Приклад для погодження — From `orders@notify.caviar.net.ua`, Reply-To `sale@caviar.net.ua`. У Resend Free на момент перевірки зазначено 100 листів на день і 3 000 на місяць. Перевірити, чи пік сповіщень про наявність поміститься в добовий ліміт. [Vercel про надсилання](https://vercel.com/kb/guide/serverless-functions-and-smtp) · [Resend Domains](https://resend.com/docs/dashboard/domains/introduction) · [Resend Pricing](https://resend.com/pricing) |
| **SMTP через HostPro, перевірити першим**    | У cPanel взяти точний TLS hostname і порт з Email Accounts → Connect Devices. Документація HostPro вказує 465 з TLS та 587 серед доступних SMTP-портів. Для 587 підтвердити STARTTLS. Попросити HostPro підтвердити зовнішні підключення з Vercel, добові/годинні ліміти тарифу й правила автоматичної відправки. Vercel блокує вихідний порт 25. Використати окремий службовий обліковий запис з окремим паролем, серверний Node runtime, TLS та обмежений час очікування. Тестувати з фактичного середовища Vercel. [HostPro SMTP](https://billing.hostpro.ua/index.php?rp=/knowledgebase/286/Nastroika-pochtov%D1%8Bkh-klyentov.html) · [cPanel Email Accounts](https://docs.cpanel.net/cpanel/email/email-accounts/) · [Vercel SMTP](https://vercel.com/kb/guide/serverless-functions-and-smtp)                          |

- Видача промокоду, оплата, відправлення та повернення товару в наявність запускаються за збереженою подією. Повтор webhook або невдалий запит не повинен надсилати дубль. Для цього зберігати власний ID події та стан спроби, а при доступності використовувати ключ ідемпотентності провайдера. Обробку пошти відокремити від успішного запису замовлення. Провайдерська відповідь про прийняття листа й підтверджена доставка — різні стани. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- Підготувати локалізовані теми й шаблони UA/EN. Перед увімкненням перевірити підтвердження, промокод і сповіщення з контрольованими адресатами. У dev використовувати окремий ключ та тестових адресатів або вимкнену відправку. Реальні листи, акаунти й DNS в межах дослідження не налаштовували.

**Рішення для MVP.** Спочатку підтверджуємо у HostPro, що автоматична відправка з Vercel дозволена в наявному тарифі, та отримуємо конкретні годинні й добові ліміти. Після цього перевіряємо TLS, SPF, DKIM і доставку тестових листів. Якщо цього достатньо для реального обсягу, залишаємо HostPro як SMTP-відправника без другої підписки. Якщо є обмеження з’єднання, доставки або квот, використовуємо Resend Free після перевірки пікового обсягу. Понад квоту листи лишаються в черзі з контрольованими повторними спробами; стан доставки видно окремо. [Vercel SMTP](https://vercel.com/kb/guide/serverless-functions-and-smtp) · [Resend Pricing](https://resend.com/pricing)

**Можливий переїзд пізніше.** Зберігаємо `caviar.net.ua` та наявні адреси скриньок. Вибір транспортного провайдера відокремлюємо від шаблонів, ID подій та даних замовлень. За переходу на Hosting Ukraine чи іншого провайдера окремо переносимо історію скриньок, перевіряємо приймання й доставку на новій стороні, оновлюємо MX/SPF/DKIM за його інструкціями й тримаємо попередній поштовий сервіс доступним до завершення перевірки. Конкретний тариф і можливість запуску Next.js підтверджуємо в момент вибору. Переїзд залишається окремим майбутнім етапом. [Поштові скриньки Hosting Ukraine](https://www.ukraine.com.ua/wiki/mail/boxes/create/)

## 15.11.2026 — виміряно: `mail.caviar.net.ua` не має власного сертифіката

Прод-пошта впала на першій же спробі (видача промокоду → «Помилка надсилання»).
Причина не в облікових даних. Виміряно TLS-рукостисканням на порт 465:

| Хост                    | Сертифікат                                        | Довірений                               |
| ----------------------- | ------------------------------------------------- | --------------------------------------- |
| `mail.caviar.net.ua`    | CN/SAN `guru-ua4.hostsila.org`                    | **ні** — `ERR_TLS_CERT_ALTNAME_INVALID` |
| `caviar.net.ua`         | CN `caviar.net.ua`, SAN +`www`                    | так                                     |
| `guru-ua4.hostsila.org` | CN `guru-ua4.hostsila.org`, дійсний до 15.01.2027 | так, `AUTH PLAIN LOGIN`                 |

`mail.caviar.net.ua` — це CNAME на корінь, і сервер віддає власний сертифікат хостингу,
який цього імені не покриває. Тому `SMTP_HOST=mail.caviar.net.ua` із `secure: true`
не працює **ще до** будь-якого катування.

**Тимчасове рішення:** `SMTP_HOST=guru-ua4.hostsila.org`. Сертифікат збігається, хост
незалежний від кореневого `A`, тож переживе катування, і `env:check --production`
проходить (він забороняє саме літерал `caviar.net.ua`). На доставку це не впливає:
SPF/DKIM стосуються домену відправника й IP, а не імені SMTP-хоста.

**Чого це не скасовує.** Питання до HostPro лишається: дати `mail.caviar.net.ua`
власний `A` і сертифікат на це ім'я. Поки SMTP-хост — ім'я сервера спільного хостингу,
перенесення акаунта на інший сервер тихо зламає пошту. Після видачі сертифіката
повернути `SMTP_HOST=mail.caviar.net.ua`.

## 15.11.2026, ввечері — обидві умови виконано, розділ закрито

**`mail.caviar.net.ua` відв'язано від кореня.** CNAME замінено на власний `A`
(`91.239.232.33`), MX кореня переведено на `0 mail.caviar.net.ua.`, SPF позбувся `+a`
(`v=spf1 +mx +ip4:91.239.232.33 ~all`). Звірено на всіх чотирьох NS; `MX → mail → A`
веде на сервер, який відповідає `220 guru-ua4.hostsila.org ESMTP Exim 4.100.1`. Деталі
й виміряні властивості зони — у [release-checklist.md](release-checklist.md), розділ A.

**Сертифікат видано** у відповідь на тікет. Виміряно:

|                    |                                                                |
| ------------------ | -------------------------------------------------------------- |
| subject            | `CN=caviar.net.ua`                                             |
| SAN                | `caviar.net.ua`, **`mail.caviar.net.ua`**, `www.caviar.net.ua` |
| issuer             | Let's Encrypt YR1                                              |
| дійсний            | 15.11.2026 19:27 EET — 13.02.2027                              |
| перевірка по імені | `Verify return code: 0 (ok)` (було `62 (hostname mismatch)`)   |

Отже **таблиця вище з «ні — ERR_TLS_CERT_ALTNAME_INVALID» більше не описує поточний
стан** і лишається як історія діагностики. `SMTP_HOST=mail.caviar.net.ua` робочий;
`guru-ua4.hostsila.org` із тимчасового рішення більше не потрібен.

HostPro письмово підтвердили й решту: пошта працює при зовнішньому веб-`A` за умови
`mail.caviar.net.ua → 91.239.232.33` і MX на це ім'я (саме так і зроблено), а зміна SPF
на відправлення не впливає, поки IP поштового сервера лишається в записі.

**Що з цього випливає на січень.** Сертифікат покриває три імені, і два з них —
`caviar.net.ua` та `www` — після катування відповідатимуть уже не на сервері HostPro.
Автопродовження (~14.01.2027, за 30 днів до кінця) перевірятиме всі три. Якщо AutoSSL
виключить недоступні імена й перевидасть із рештою — пошта вціліє; якщо впаде цілком —
**TLS на пошті зламається тихо в середині січня**. Підстава сподіватись на краще є:
DNS-зона лишається в HostPro, тож перевірка через `_acme-challenge` TXT працюватиме й
після переїзду, на відміну від перевірки по HTTP. Але це не перевірено, тож дату варто
тримати в полі зору.

## Що ще потрібно побачити

- У cPanel — **Email Routing** і **Email Deliverability** для кореневого домену. За потреби **Connect Devices** для робочої скриньки, достатньо hostname, портів і типу TLS. Паролі, Support PIN, токени й приватні ключі не потрібні.
- У HostPro — підтвердження правильної цілі MX, можливості залишити пошту й DNS при зовнішньому веб-A, обмеження зовнішнього SMTP та чи є окремий поштовий тариф, якщо старий хостинг згодом вимикають.
- У Vercel — сторінка **Domains** production-проєкту з рекомендованими записами, коли дійдемо до підключення. Узгодити From, Reply-To і хто моніторить невдалі доставки.

## Локальні документи

`/docs/` додаємо до `.gitignore`. Вилучення `design-review.md` і `storefront-handoff.md` з індексу підготовлено. Локальні копії збережено. Попередні коміти міститимуть свої версії.

## 11.11.2026 — checkout rollout

- Keys were checked read-only: mono merchant details/public key and NP directories returned success. Their values were never printed. One supplied mono key is treated as live, not as a public sandbox token. A separate test token can be issued through https://api.monobank.ua/; no shared token is embedded.
- Local DEV flags: CHECKOUT_ENABLED=true, MONO_MODE=live, ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT=true, ORDER_EMAIL_ENABLED=true. Existing secrets and SITE_URL were preserved. Local HTTP SITE_URL deliberately blocks new online orders before reserving stock. DEV receipt recipients stay allowlisted.
- Before DEV end-to-end payment: deploy these changes, add server-only MONO_TOKEN and NOVA_POSHTA_API_KEY to the DEV Vercel project, set public HTTPS SITE_URL to that deployment, the flags above and SMTP configuration, and set a random CRON_SECRET. Production uses its own Firebase/SMTP settings and MONO_MODE=live; keep checkout disabled until the release smoke test. Do not enable live payments on arbitrary preview deployments.
- Webhook: POST /api/payments/mono/webhook, raw-body ECDSA/SHA256 X-Sign verification, amount/currency/reference/invoice checks, idempotent and ordered transitions. Authenticated status reconciliation is available from the private customer receipt and staff order. Cookie access is bound to the browser that placed the order; email contains order details/site contacts, not a public PII-bearing receipt link.
- Hosted mono payment offers the provider’s supported card/app/wallet choices. Direct Apple Pay/Google Pay buttons are not implemented because their merchant/domain onboarding is separate; the checkout action is “Continue to payment”.
- Order notifications: created, payment confirmed and manual TTN attached. Pending/failed/unknown/accepted states remain visible. A disconnect after SMTP DATA is not automatically retried. “Accepted” means accepted by SMTP, not guaranteed inbox delivery.
- NP label creation is manual by the client’s final decision (variable Kyiv/Ladyzhyn departure point and variable boxes). Recipient always pays carrier charges, outside the basket and promo. A paid packed order accepts a 14-digit TTN after carrier lookup; the associated email says prepared, not handed over. Changing staff fulfillment state to shipped remains a separate action. Deleting the label happens in NP; refunds happen in banking. Phase 2 may automate labels after packaging is standardized.
- Pending invoices use 15-minute validity. Browser/staff reconciliation releases verified failed/expired reserves; the free-plan-compatible daily job is a fallback, so an abandoned reservation may last until that job or a staff check. If traffic requires faster background release, revisit scheduling before opening sales; never release a payable invoice solely by age.
- Still require a real controlled payment, verified callback on the deployed URL, order/customer/inventory/promo reconciliation and delivered created/paid/TTN emails before production acceptance. Final legal identity, retention and fiscal receipt/pRRO configuration remain seller/legal handoff items; do not infer them from a screenshot.
