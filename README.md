# elaraby_workforce (Elaraby Connect)

تطبيق موظفين لشركة العرابي جروب — وورديات، مرتبات، طلبات HR، ومزايا الشركة. مبني بـ Flutter ومطابق لتصميمات Figma الموجودة في فولدر `ui ux/`.

## التشغيل

```bash
flutter pub get
flutter run
```

## الحالة الحالية (Production-grade local)

التطبيق شغال بالكامل **محلياً بدون backend**: كل البيانات تُحفظ وتُستعاد بين الجلسات عبر `shared_preferences`:

- **تسجيل دخول كامل**: رقم قومي (validation 14 رقم) → OTP (إدخال حقيقي + عداد resend) → تأكيد البروفايل → إنشاء PIN (مُخزَّن hashed في `LocalStore`) → تأكيد PIN (يقارن فعلاً).
- **شاشة قفل PIN** عند إعادة فتح التطبيق بعد الـ onboarding، مع "نسيت الرمز؟" (إعادة تعيين تمسح الجلسة).
- **الطلبات** (إجازة / HR) تُخزَّن في `RequestsStore` المستمر — إرسال طلب إجازة يخصم من رصيد الإجازات، وشارة PENDING في شاشة الخدمات ديناميكية.
- **طلب إجازة** بـ date pickers وحساب أيام فعلي (وحدود رصيد).
- **قسيمة المرتب** تولّد PDF حقيقي ويُشارك عبر نافذة المشاركة في النظام، مع خيار "حماية القسيمة بـ PIN" من الإعدادات.
- **الإعدادات والميزات**: toggles محفوظة، حجز رحلات محفوظ، حالة مقروء/غير مقروء للـ Inbox مرتبطة بنقطة الإشعارات، استبيان محفوظ.
- **بيانات الموظف** قابلة للتعديل وتُحفظ وتظهر في البروفايل والهيدر (الاسم/الأحرف الأولى).
- **تعريب كامل** (217 مفتاح en/ar متطابقين) مع حفظ اللغة المختارة.
- خط **Inter مدمج** في التطبيق (يعمل offline من أول تشغيل)، وأيقونة مولّدة عبر `flutter_launcher_icons` (المصدر: `icon_1024.png`).

## البنية

```
lib/
├── core/
│   ├── localization/app_locale.dart   # ترجمة + حفظ اللغة
│   ├── storage/local_store.dart       # كل الحفظ المحلي (جلسة/PIN/بروفايل/إعدادات)
│   └── theme/                         # ألوان وخطوط Design System
└── features/
    ├── auth/            # splash → get started → ID → OTP → تأكيد → PIN → قفل PIN
    ├── home/            # إعلانات، شفت، متريكس، quick actions، أخبار، استبيان
    ├── services/        # مرتب، ورديات، إجازات، طلبات HR (+ data/ stores)
    ├── benefits/        # مزايا ورحلات
    ├── inbox/           # إشعارات + inbox_ids.dart (حالة المقروء)
    ├── profile/         # بروفايل، إعدادات، تغيير PIN، دعم (tel/wa حقيقيين)
    └── main_navigation/ # 5 تابات بـ IndexedStack + bottom bar مخصص
```

## الباك إند والأدمن داشبورد

```bash
cd server && npm install && npm start
```

- **API**: على `http://localhost:3000/api` — مصادقة OTP/PIN حقيقية، طلبات، إشعارات، محتوى (التفاصيل في `server/README.md`).
- **الأدمن داشبورد**: `http://localhost:3000/admin/` — إدارة موظفين، موافقة/رفض طلبات، نشر إعلانات وأخبار ومزايا ورحلات. (تُنشأ الحسابات بكلمات مرور مشفرة بـ Scrypt عبر إعدادات البيئة `ADMIN_USER` و `ADMIN_PASS`).
- **تطبيق الموبايل**: المصادقة والطلبات والإشعارات على السيرفر، مع **offline-first** — لو السيرفر مطفي التطبيق يشتغل بالبيانات المحلية. للإنتاج: `overrideBaseUrl` في `lib/core/network/api_client.dart`.

## متطلبات وتشغيل بيئة الإنتاج (Production Configuration)

يفرض النظام سياسة أمان صارمة (**Zero Silent Development Fallbacks**) تمنع العمل بأي محاكيات أو تخزين مؤقت عند تفعيل وضع الإنتاج (`NODE_ENV=production`):

### 1. قاعدة بيانات PostgreSQL (`DATABASE_URL`)
- **إلزامية**: في بيئة الإنتاج يرفض السيرفر تماماً استخدام ملفات الـ JSON في الذاكرة (`db.data()`) ويرمي استثناءً قاتلاً إذا لم يكن `DATABASE_URL` معرفاً.
- **صيغة الاتصال**:
  ```env
  DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require
  ```
- **الميزات المفعلة**: Connection Pooling مع إعادة المحاولة التلقائية، استعلامات parameterized ضد هجمات SQL Injection، وتفعيل Row-Level Security والعزل التام للمستأجرين Multi-Tenant.
- **ترحيل البيانات**: لترحيل البيانات الأولية من JSON إلى PostgreSQL:
  ```bash
  npm run migrate:pg
  ```

### 2. وسيط الرسائل والكاش Redis (`REDIS_URL`)
- **إلزامية**: يرفض النظام العمل عبر `InMemoryRedisMock` في بيئة الإنتاج لضمان موثوقية طوابير المهام الموزعة وتزامن أحداث SSE عبر السيرفرات المتعددة.
- **صيغة الاتصال**:
  ```env
  REDIS_URL=redis://:<redis_password>@<redis_host>:6379
  ```
- **طوابير المهام (BullMQ Worker)**: لتشغيل معالج الرسائل والإشعارات الموزع في الخلفية:
  ```bash
  npm run worker
  ```

### 3. إعدادات النشر السحابي والسيرفرليس (Vercel & Cloud Functions)
عند النشر على Vercel أو منصات Serverless (`VERCEL=1`):
- يُحظر كلياً الاعتماد على التخزين المؤقت في مجلد `/tmp` لتفادي فقدان بيانات المعاملات المالية والحضور والانصراف.
- يجب تهيئة المتغيرات البيئية التالية في لوحة التحكم:
  | المتغير | الوصف | المتطلبات |
  | :--- | :--- | :--- |
  | `NODE_ENV` | بيئة التشغيل | `production` |
  | `DATABASE_URL` | رابط اتصال PostgreSQL سحابي (Neon / Supabase / AWS RDS) | مشفر بـ SSL |
  | `REDIS_URL` | رابط اتصال Redis سحابي (Upstash / Redis Cloud) | TLS مفعّل |
  | `JWT_SECRET` | مفتاح توقيع رموز المصادقة JWT | 32 حرفاً عشوائياً كحد أدنى |
  | `ADMIN_PASS` | كلمة مرور حساب الأدمن المبدئي | كلمة مرور معقدة |
  | `STORAGE_PROVIDER` | مزود تخزين المرفقات | `s3` أو `gcs` (أو `local` للاختبارات فقط) |

### 4. فحوصات الجاهزية ومراقبة الصحة (Health Probes)
- **Kubernetes / Cloud Readiness Probe**:
  - الرابط: `GET /api/health/ready`
  - السلوك: يعيد `HTTP 200 OK` فقط عندما تكون قاعدة بيانات PostgreSQL و Redis متصلين وجاهزين لاستقبال الطلبات؛ ويعيد `HTTP 503 Service Unavailable` في حال انقطاع أي منهما في بيئة الإنتاج.
- **Liveness Probe**: `GET /api/health` للتأكد من استجابة خادم الويب Express.
- **التحقق الاستباقي من الإعدادات**:
  ```bash
  npm run validate:production
  ```

## ما ينقص للنشر الفعلي على المتاجر

- استضافة سحابية للسيرفر + دومين HTTPS + SMS gateway حقيقي (كل الكود جاهز ومغطى باختبارات المحاكاة).
- keystore/release signing، حسابات Play Console و Apple Developer، Privacy Policy.
- توزيع داخلي مقترح لكونه تطبيق موظفين: Managed Google Play + Apple Business Manager.

## الاختبارات الشاملة (Automated Test Suites)

```bash
# اختبارات الباك إند (56 جناح اختبار تغطي الأمان والـ RBAC والمعاملات المتزامنة وبنك الرواتب)
cd server && npm test

# جناح الاختبارات الشامل E2E بدون اعتماديات خارجية (395 اختبار عبر 4 مستويات)
node test_infra/runner.js

# اختبارات تطبيق الموبايل (Flutter Unit & Widget Tests)
flutter test

# الفحص الاستاتيكي لكود الفلاتر
flutter analyze
```
