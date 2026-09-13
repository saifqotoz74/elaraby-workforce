# دليل الربط السحابي المجاني للإنتاج (Neon + Upstash + Koyeb)
**Workforce OS (PR Connect) — 100% Free Production Deployment Guide**  
**التكلفة:** 0.00$ (مجاناً مدى الحياة بدون بطاقة بنكية)  
**الوقت المتوقع:** 5 إلى 7 دقائق فقط  

---

## المكونات الثلاثة ومهمة كل منها:

```
+------------------------------------------------------------------------------------+
|                                الهيكلية السحابية المجانية                           |
+--------------------------+----------------------------+----------------------------+
| 1. خادم التطبيق (Node.js)| 2. قاعدة البيانات (Postgres)| 3. طوابير العمل (Redis)    |
|       Koyeb.com          |         Neon.tech          |        Upstash.com         |
|   (سيرفر + دومين HTTPS)  |   (بيانات الموظفين والشركات)|  (طوابير OTP والرسائل)     |
+--------------------------+----------------------------+----------------------------+
```

---

## الخطوة 1: إنشاء قاعدة بيانات PostgreSQL على Neon.tech (دقيقة واحدة)

1. افتح موقع **[https://neon.tech](https://neon.tech)** واضغط **Sign Up with GitHub**.
2. اضغط على زر **"Create Project"**:
   * اسم المشروع (Project Name): `pr-connect-db`
   * إصدار قاعدة البيانات: `PostgreSQL 16` (الافتراضي)
   * المنطقة (Region): اختر `Frankfurt (eu-central-1)` أو الأقرب لمصر والخليج.
3. اضغط **"Create Project"**.
4. فوراً ستظهر لك نافذة منبثقة بعنوان **"Connection Details"**:
   * ستجد رابطاً جاهزاً يبدأ بـ `postgres://` أو `postgresql://`.
   * مثال للرابط:
     ```text
     postgresql://neondb_owner:npg_xyz123@ep-cool-fog-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require
     ```
5. **انسخ هذا الرابط** واحتفظ به جانباً، هذا هو رابط `DATABASE_URL`.
*(ملاحظة: السيرفر مبرمج تلقائياً عند أول تشغيل لإنشاء كل الجداول وفهارس الشركات وسياسات الأمان RLS فور الاتصال بهذا الرابط).*

---

## الخطوة 2: إنشاء خادم Redis 7 على Upstash.com (دقيقة واحدة)

1. افتح موقع **[https://upstash.com](https://upstash.com)** وسجل الدخول باستخدام **GitHub**.
2. اضغط على **"Create Database"** في تبويب **Redis**:
   * اسم القاعدة (Name): `pr-connect-redis`
   * المنطقة (Region): اختر نفس منطقة قاعدة البيانات `Frankfurt (eu-central-1)` لتقليل وقت الاستجابة (Latency).
   * نوع الباقة: **Serverless (Free)**.
3. اضغط **"Create"**.
4. بعد إنشاء القاعدة، انزل لأسفل الصفحة عند قسم **"Connect to your database"**:
   * اختر خيار **Node.js** أو اضغط على رابط **ioredis** أو انسخ الرابط المشفر الذي يبدأ بـ `rediss://`.
   * مثال للرابط:
     ```text
     rediss://default:AbCdEf123456@eu-central-1.upstash.io:6379
     ```
5. **انسخ هذا الرابط** واحتفظ به جانباً، هذا هو رابط `REDIS_URL`.

---

## الخطوة 3: تشغيل السيرفر على Koyeb.com (3 دقائق)

1. افتح موقع **[https://koyeb.com](https://koyeb.com)** وسجل الدخول بحساب **GitHub**.
2. اضغط على الزر الأخضر **"Create App"** أو **"Create Service"**.
3. في شاشة مصدر الكود (Deployment Source):
   * اختر **GitHub**.
   * اختر المستودع الخاص بك (Repository): **`PR Connect`**.
   * الفرع (Branch): `main` (أو الفرع النشط لديك).
4. في إعدادات البناء والتنفيذ (Build and Deployment Settings):
   * **Root Directory:** اكتب: `server` (لأن ملفات الباك إند داخل مجلد `server`).
   * **Build Method:** اختر **Dockerfile** (سيكتشف تلقائياً ملف `server/Dockerfile` الموجود).
5. في قسم حجم السيرفر (Instance Type):
   * اختر الباقة المجانية: **Free (Nano - 512MB RAM)**.
6. في قسم المتغيرات البيئية (**Environment Variables**)، اضغط "+ Add Variable" وأضف القيم الآتية:

| المتغير (Key) | القيمة (Value) | الشرح |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | لتفعيل حماية الإنتاج وحظر أكواد الـ Mock |
| `PORT` | `3000` | المنفذ الافتراضي |
| `DATABASE_URL` | *(الصق رابط Neon الذي نسخته في الخطوة 1)* | للاتصال بقاعدة بيانات PostgreSQL 16 |
| `REDIS_URL` | *(الصق رابط Upstash الذي نسخته في الخطوة 2)* | لطوابير BullMQ وقفل العمليات المتزامنة |
| `ADMIN_USER` | `admin` | اسم مستخدم لوحة السوبر أدمن |
| `ADMIN_PASS` | `SuperSecret2026!` | كلمة سر لوحة السوبر أدمن (اختر كلمة قوية) |
| `JWT_SECRET` | `pr_connect_super_jwt_secret_key_prod_2026` | مفتاح تشفير التوكنات |

7. في قسم المنافذ والشبكة (**Ports & Routing**):
   * تأكد أن الـ Port هو: `3000`.
   * الـ Protocol: `HTTP`.
   * الـ Public Route: `/`.
8. اضغط على زر **"Deploy"** بالأسفل!

---

## الخطوة 4: التحقق من نجاح التشغيل

1. سيبدأ Koyeb في بناء وتشغيل الحاوية (Container)، ويستغرق حوالي 60 إلى 90 ثانية.
2. بمجرد اكتمال البناء ستتحول الحالة إلى **Healthy (باللون الأخضر)**.
3. سيعطيك Koyeb رابطاً رسمياً مشفراً بـ SSL، مثلاً:
   `https://pr-connect-saif.koyeb.app`
4. للتأكد من أن السيرفر يعمل وقاعدة البيانات والريديس متصلان بنجاح:
   * افتح في المتصفح:
     `https://pr-connect-saif.koyeb.app/api/health`
     ستجد استجابة:
     ```json
     { "status": "ok", "environment": "production", "services": { "database": "connected", "redis": "connected" } }
     ```
   * افتح لوحة التحكم المرئية:
     `https://pr-connect-saif.koyeb.app/admin/`
     سجل دخولك باسم `admin` وكلمة السر التي اخترتها، وستفتح معك لوحة الإدارة وشاشة السوبر أدمن لإدارة الشركات فوراً!

---

## الخطوة 5: ربط تطبيق الموبايل (Flutter) بالرابط الجديد

في مشروعك على جهازك، افتح ملف:
`lib/core/network/api_client.dart`
وعدّل الرابط الافتراضي للـ API:
```dart
static const String _defaultBaseUrl = 'https://pr-connect-saif.koyeb.app';
```

مبروك! تطبيقك بالكامل وسيرفره وقاعدة بياناته وطوابير الـ OTP أصبحت تعمل حياً على السحابة مجاناً 100%.
