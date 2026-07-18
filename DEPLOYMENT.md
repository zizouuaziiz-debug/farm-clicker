# دليل النشر — Vercel + Railway

هذا المشروع يُنشر كثلاث خدمات منفصلة:

| الخدمة | المنصة | المسار |
|---|---|---|
| `api-server` (السيرفر) | **Railway** | `artifacts/api-server` |
| `farm-clicker` (اللعبة) | **Vercel** | `artifacts/farm-clicker` |
| `farm-admin` (لوحة الإدارة) | **Vercel** | `artifacts/farm-admin` |

**مهم جداً بخصوص الترتيب:** نشِّط السيرفر على Railway أولاً وخذ رابطه، لأن
الواجهتين على Vercel تحتاجان هذا الرابط كمتغير بيئة (`VITE_API_BASE_URL`) قبل
أن تبنيهما.

---

## 1. رفع المشروع على GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <رابط مستودعك على GitHub>
git push -u origin main
```

---

## 2. نشر السيرفر (API) على Railway

1. من لوحة Railway: **New Project → Deploy from GitHub repo** واختر هذا المستودع.
2. Railway سيقرأ ملف `railway.json` الموجود في جذر المشروع تلقائياً، والذي يضبط:
   - أمر البناء: `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
   - أمر التشغيل: `node artifacts/api-server/dist/index.mjs`
3. **أضف قاعدة بيانات PostgreSQL:** من نفس المشروع في Railway اضغط **+ New →
   Database → PostgreSQL**. سيوفر لك Railway متغير `DATABASE_URL` تلقائياً
   ويمكنك ربطه بخدمة السيرفر (Railway يفعل ذلك تلقائياً عند إضافة قاعدة بيانات
   لنفس المشروع عبر "Variable Reference").
4. **أضف متغيرات البيئة** لخدمة `api-server` من تبويب **Variables** (راجع
   القسم 5 أدناه للقائمة الكاملة). لا تضبط `PORT` يدوياً — Railway يضبطه هو.
5. بعد أول نشر ناجح، من تبويب **Settings → Networking** فعّل **Generate
   Domain** للحصول على رابط عام مثل:
   `https://farm-clicker-api-production.up.railway.app`
   احفظ هذا الرابط — ستحتاجه في الخطوة القادمة.
6. **تجهيز قاعدة البيانات (مرة واحدة فقط):** بعد أول نشر، شغّل من جهازك محلياً
   (بعد ضبط `DATABASE_URL` في `.env` بنفس قيمة Railway):
   ```bash
   pnpm --filter @workspace/db run push
   ```
   أو طبّق `database/schema.sql` مباشرة عبر `psql`:
   ```bash
   psql "$DATABASE_URL" -f database/schema.sql
   ```
   استخدم طريقة واحدة فقط، لا الاثنتين معاً على نفس القاعدة.

---

## 3. نشر واجهة اللعبة (farm-clicker) على Vercel

1. من لوحة Vercel: **Add New → Project** واختر هذا المستودع من GitHub.
2. في شاشة إعداد المشروع، اضبط:
   - **Root Directory:** `artifacts/farm-clicker`
   - Vercel سيكتشف ملف `vercel.json` الموجود داخل هذا المجلد تلقائياً (يضبط
     أمر البناء ومجلد الإخراج `dist/public`).
3. **أضف متغيرات البيئة** (تبويب Environment Variables) لهذا المشروع فقط:
   - `VITE_API_BASE_URL` = رابط سيرفر Railway من الخطوة السابقة (بدون `/` في
     النهاية)، مثال: `https://farm-clicker-api-production.up.railway.app`
   - `VITE_ADSGRAM_BLOCK_ID` = معرّف البلوك الحقيقي من حساب Adsgram الخاص بك
4. اضغط **Deploy**. بعد النشر ستحصل على رابط مثل `https://farm-clicker.vercel.app`.
5. **حدّث `ALLOWED_ORIGINS` في Railway** لتضمين هذا الرابط (راجع القسم 5)، ثم
   أعد تشغيل خدمة `api-server` على Railway حتى يطبَّق التغيير.
6. اربط هذا الرابط في إعدادات بوت تيليجرام كـ "Web App URL" (راجع القسم 6).

---

## 4. نشر لوحة الإدارة (farm-admin) على Vercel

كرر نفس خطوات القسم 3، لكن:
- **Root Directory:** `artifacts/farm-admin`
- متغيرات البيئة المطلوبة لهذا المشروع: `VITE_API_BASE_URL` فقط (نفس رابط
  Railway). لا حاجة لـ `VITE_ADSGRAM_BLOCK_ID` هنا.
- بعد النشر ستحصل على رابط مثل `https://farm-admin.vercel.app` — أضفه أيضاً
  إلى `ALLOWED_ORIGINS` في Railway.

---

## 5. جميع متغيرات البيئة (مرجع كامل)

### على Railway (خدمة `api-server`)

| المتغير | مطلوب؟ | ملاحظات |
|---|---|---|
| `DATABASE_URL` | نعم | يُضبط تلقائياً إذا أضفت PostgreSQL من داخل مشروع Railway نفسه |
| `PORT` | يُضبط تلقائياً | لا تضبطه يدوياً |
| `NODE_ENV` | نعم | ضعه `production` |
| `ALLOWED_ORIGINS` | نعم | روابط Vercel لكل من `farm-clicker` و`farm-admin`، مفصولة بفاصلة، بدون `/` في النهاية |
| `SESSION_SECRET` | نعم | قيمة عشوائية طويلة وقوية (مثلاً 32+ حرف) |
| `TELEGRAM_BOT_TOKEN` | نعم | من [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | نعم | يوزر البوت بدون @ |
| `ALLOW_MOCK_AUTH` | لا تضبطه أو `false` | يجب أن يبقى معطّلاً في الإنتاج بشكل قاطع |
| `ADMIN_SETUP_SECRET` | مرة واحدة فقط | لإنشاء أول حساب إدمن، ثم يمكن حذفه بعد الاستخدام |
| `VIP_WALLET_ADDRESS` | نعم | عنوان محفظتك لاستقبال دفعات VIP |
| `LOG_LEVEL` | اختياري | القيمة الافتراضية `info` |

### على Vercel (مشروع `farm-clicker`)

| المتغير | مطلوب؟ | ملاحظات |
|---|---|---|
| `VITE_API_BASE_URL` | نعم | رابط سيرفر Railway |
| `VITE_ADSGRAM_BLOCK_ID` | نعم (للإعلانات الحقيقية) | من حساب Adsgram — بدونه يعمل بقيمة تجريبية فقط |

### على Vercel (مشروع `farm-admin`)

| المتغير | مطلوب؟ | ملاحظات |
|---|---|---|
| `VITE_API_BASE_URL` | نعم | نفس رابط سيرفر Railway |

راجع أيضاً ملف `.env.example` في جذر المشروع — يحتوي كل هذه المتغيرات مع شرح
تفصيلي بجانب كل واحدة.

---

## 6. إعداد بوت تيليجرام

1. أنشئ بوتاً عبر [@BotFather](https://t.me/BotFather) إن لم يكن موجوداً.
2. من نفس المحادثة مع BotFather، استخدم أمر `/newapp` أو `/setmenubutton`
   لربط رابط "Web App" برابط `farm-clicker` على Vercel.
3. ضع `TELEGRAM_BOT_TOKEN` (توكن البوت) و`TELEGRAM_BOT_USERNAME` (يوزره بدون
   @) في متغيرات Railway.
4. لوحة الإدارة (`farm-admin`) **ليست** داخل تيليجرام — هي موقع ويب عادي بتسجيل
   دخول بريد/كلمة مرور. لإنشاء أول حساب إدمن، اضبط `ADMIN_SETUP_SECRET` في
   Railway ثم نفّذ طلب على مسار الإعداد الخاص به (راجع
   `artifacts/api-server/src/routes/admin-auth.ts` لمعرفة المسار الدقيق)،
   بعدها يمكنك حذف `ADMIN_SETUP_SECRET` لتعطيل المسار.

---

## 7. التحقق النهائي بعد النشر

- [ ] فتح رابط `farm-clicker` على Vercel والتأكد من ظهور اللعبة بدون أخطاء في
      الـ Console (اختبار حقيقي يتطلب فتحه من داخل تيليجرام، وليس متصفح عادي،
      لأن التوثيق الحقيقي يعتمد على بيانات تيليجرام).
- [ ] فتح رابط `farm-admin` والتأكد من ظهور شاشة تسجيل الدخول.
- [ ] تسجيل الدخول بحساب الإدمن الذي أنشأته والتأكد من ظهور البيانات
      (المستخدمين، السحوبات...) بدون أخطاء CORS في الـ Console.
- [ ] التأكد أن `ALLOW_MOCK_AUTH` غير مضبوط على Railway (تحقق من تبويب
      Variables).
- [ ] التأكد أن `ADMIN_SETUP_SECRET` تم حذفه بعد إنشاء أول إدمن.
- [ ] التأكد أن `VITE_ADSGRAM_BLOCK_ID` هو معرّف حقيقي وليس القيمة التجريبية.

---

## 8. ملاحظات عامة

- المشروع `pnpm workspace` — لا تشغّل `npm install`، استخدم `pnpm install`
  فقط، وإلا ستفسد ملف `pnpm-lock.yaml`.
- إذا عدّلت `lib/api-spec/openapi.yaml`، شغّل
  `pnpm --filter @workspace/api-spec run codegen` قبل البناء، لتحديث الكود
  المولَّد في `lib/api-zod` و `lib/api-client-react`.
- لتحديث سكيمة قاعدة البيانات لاحقاً، عدّل `lib/db/src/schema/*` ثم شغّل
  `pnpm --filter @workspace/db run push` (أو حدّث `database/schema.sql` يدوياً
  إذا كنت تفضل SQL خام).
