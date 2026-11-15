# Чекліст: вихід у прод

Оновлено 2026-11-13. Значення змінних — у [env-reference.md](env-reference.md). Деталі DNS — у [hosting-and-email.md](hosting-and-email.md).

Порядок має значення: пошта й DNS ламаються саме тоді, коли кроки міняють місцями.

---

## A. Пошта на хостингу (робити першим, не залежить від решти)

1. cPanel → **Email Accounts** → створити `notify@caviar.net.ua`. Пароль зберегти в менеджері паролів.
2. На `notify@` увімкнути **пересилання на `sale@caviar.net.ua`**. Бавнси й автовідповіді йдуть на адресу відправника — без цього не побачите недоставлених листів.
3. HostPro: підтвердити незалежний поштовий hostname (`mail.caviar.net.ua` з власним `A`) і що пошта лишається на HostPro, коли сайт піде на Vercel.
4. Змінити `mail.caviar.net.ua` з CNAME на `A`, MX кореня спрямувати на `mail.caviar.net.ua.`. **До** будь-яких змін веб-`A`.
5. Переписати SPF: поточний `v=spf1 +a +mx +ip4:91.239.232.33 ~all` містить `+a`, який після переїзду вкаже на Vercel. Звірити DKIM, підняти DMARC із `p=none` після перевірки.
6. Дати старим кешам MX і `mail` сплинути (TTL 14 400 с = 4 год; знизити заздалегідь).

## B. Дані клієнта (Firebase + Cloudinary зараз порожні)

7. Наповнити prod-Firestore: товари, фасування, залишки, подарункові набори, SEO-поля.
8. Задеплоїти індекси Firestore: `npx firebase deploy --only firestore:indexes --project caviar-berry-prod`. Перевірено 14.11.2026: база `(default)` у prod існує, але індексів у ній **0**, тож деплой лише додає й нічого не видаляє. Без них впадуть списки замовлень/заявок/клієнтів, звіт за каналами і — найтихіше — `collectionGroup("notifications")` у `/api/internal/reconcile`, тобто пересилання застряглих листів. Звірити після деплою: `npx firebase firestore:indexes --project caviar-berry-prod` має дати ті самі 25 індексів і 1 `fieldOverrides`, що в `firestore.indexes.json`.
9. Залити медіа в prod-Cloudinary, звірити `src/content/bundled-catalog-media.json`.
10. Задеплоїти правила доступу Firestore: `npx firebase deploy --only firestore:rules --project caviar-berry-prod`. Правила лежать у `firestore.rules` і забороняють **усе** — жоден клієнт не читає Firestore напряму, а веб-ключ і project id присутні в браузері для Google-входу. У консолі переконатися, що активна версія правил саме ця (не «test mode»).
11. Увімкнути TTL у Firestore prod-проєкту на полі `expiresAt` для колекцій `checkoutLimits` і колекції лімітів заявок. Без цього документи лімітів накопичуються без обмежень — у коді це зробити неможливо, лише в консолі або через `gcloud firestore fields ttls update`.

## C. Змінні на Vercel

12. Prod-проєкт → Environment Variables → внести все з розділів 1–6 реєстру.
13. Обов'язково змінити проти DEV: `SMTP_USER`, `MAIL_FROM` → `notify@`; `SMTP_HOST` → `mail.caviar.net.ua`; `MAIL_REPLY_TO` → `sale@`; `OWNER_NOTIFICATION_EMAILS` → `sales@faic.com.ua,faic.caviar@gmail.com`; `ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT` → `false`; `TEST_PRODUCT_ENABLED` → `false`.
14. Дописати відсутні: `CHECKOUT_ENABLED`, `MONO_MODE`, `ORDER_EMAIL_ENABLED`, `OWNER_EMAIL_ENABLED`, `RESTOCK_EMAIL_ENABLED`, `MAIL_TEST_RECIPIENTS`, `CRON_SECRET`.
15. Окремі prod-значення `MONO_TOKEN`, `NOVA_POSHTA_API_KEY`, `CLOUDINARY_*`, `FIREBASE_*`. **Не копіювати DEV-секрети.**
16. `npm run env:check -- --production` — має пройти без помилок.

## D. Перевірка перед перемиканням домену

17. `npm run check` (Prettier, ESLint, TypeScript, тести). Середовище тестів закріплене в `package.json`, тож локальний прогін і CI ідентичні — окремо нічого експортувати не треба.
18. `npx next build --webpack` (саме `--webpack`, Turbopack-білд тут зависає).
19. `/qa full` — матриця viewport × локаль × браузер, обов'язково фізичний iOS Safari.
20. `/ship` — реліз-гейт: інваріанти SEO, комерції, пошти, інфраструктури.
21. Перевірити `noindex` на `dev-caviar-berry.vercel.app` і прев'ю; індексація **лише** на `SITE_URL=https://caviar.net.ua`.
22. Перевірити, що `checkout-test` відсутній у каталозі, `sitemap.xml` і `Product`/`Offer` JSON-LD.
23. `canonical` і `hreflang` (`ua`, `en`, `x-default`) без UTM і query.
24. Наскрізний прогін на прод-середовищі до перемикання DNS: замовлення → оплата → вебхук → лист клієнту → лист працівникам → запис клієнта.
25. `npm run mail:test -- order-ua` (і `promo-ua`, `restock-en`) з прод-скриньки. Перевірити заголовки SPF/DKIM/DMARC у отриманому листі.
26. Переконатися, що теми листів **без** `[TEST]` (префікс зникає при `APP_ENV=production`).

## E. Перемикання домену

27. Перемкнути кореневий `A` на Vercel — **тільки після** виконаних кроків 3–6.
28. Повторити зовнішні тести пошти й вебмейлу.
29. Перевірити вхідні та вихідні листи на реальних скриньках.
30. Зберегти попередні `A`/`CNAME` і доступ до WordPress для відкату.

## F. Після релізу

31. Перевірити, що щоденний крон `/api/internal/reconcile` відпрацьовує.
32. Простежити перші реальні замовлення: оплата, списання залишку, листи, ТТН.
33. Google Search Console: додати домен, подати sitemap.
34. **Увімкнути обмеження запитів на краю.** У коді стоїть per-IP бюджет
    (`src/lib/server/rate-limit.ts`), але він живе в памʼяті інстансу: скидається на
    холодному старті й рахує окремо в кожному інстансі. Він рятує від одного скрипта,
    що молотить один ендпоінт, і **не** рятує від розподіленого флуду. Авторитетний
    ліміт має стояти у Vercel Firewall, бо він ріже запит **до** того, як інвокація
    стане платною. Подивитись у проєкті, що доступно на поточному тарифі (Firewall із
    правилами обмеження, Attack Challenge Mode) і ввімкнути для `/api/*`.
    Бюджети в коді: `delivery` 60/хв, `newsletter` і `inquiries` 10/10 хв,
    `checkout` 15/10 хв — остання навмисно щедра, щоб покупець міг повторити оплату.

---

## Пастки, перевірені на практиці

- **`MAIL_FROM` мусить дорівнювати `SMTP_USER`** — інакше вся пошта падає з `CONFIGURATION`.
- **Прод відмовляється слати з `dev-notify@`** — це захист, а не баг. Поки нову скриньку не створено, прод-пошта мовчить.
- **`MONO_MODE=live` у DEV** — списуються справжні гроші. Автоматичних платіжних тестів не запускати.
- **`PROMOTION_PUBLIC_ENABLED=true`** — попап приймає будь-яку адресу. Якщо прод іще не готовий до розсилки, ставити `false`.
- **Турбопак-білд зависає** в цьому оточенні — лише `npx next build --webpack`.
- **Firestore/Firebase Admin лишаються в `serverExternalPackages`** (`next.config.ts`): мініфікація ламає конструктор `Long` у protobuf.
- **`Origin` не перевіряють на GET-ендпоінтах.** Браузери його там не надсилають — зміряно в Chromium і WebKit: обидва дають `Sec-Fetch-Site: same-origin` і **жодного** `Origin`. Перевірка `Origin` на GET зламала б поле міста в чекауті. POST-ендпоінти `Origin` отримують, тож у них усе правильно.
- **Локально `127.0.0.1` і `localhost` — різні origin.** Через `127.0.0.1:3100` усі POST-ендпоінти відмовляють, навіть із правильним заголовком. Перевіряти форми тільки через `http://localhost:3100`. Це не дефект коду, а пара «хост у запиті проти `Origin`».
