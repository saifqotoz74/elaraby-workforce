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

## الباك إند والأدمن داشبورد (متوصلين فعلاً)

```bash
cd server && npm install && npm start
```

- API على `http://localhost:3000/api` — مصادقة OTP/PIN حقيقية، طلبات، إشعارات، محتوى (التفاصيل في `server/README.md`).
- **الأدمن داشبورد**: http://localhost:3000/admin/ (`admin` / `elaraby2026`) — إدارة موظفين، موافقة/رفض طلبات (إشعار فوري للموظف)، نشر إعلانات وأخبار ومزايا ورحلات.
- التطبيق موصّل: المصادقة والطلبات والإشعارات على السيرفر، مع **offline-first** — لو السيرفر مطفي التطبيق يشتغل بالبيانات المحلية. للإنتاج: `overrideBaseUrl` في `lib/core/network/api_client.dart`.

## ما ينقص للنشر الفعلي على المتاجر

- استضافة سحابية للسيرفر + دومين HTTPS + SMS gateway حقيقي (كل الكود جاهز).
- keystore/release signing، حسابات Play Console و Apple Developer، Privacy Policy.
- توزيع داخلي مقترح لكونه تطبيق موظفين: Managed Google Play + Apple Business Manager.

## الاختبارات

```bash
flutter test      # unit + widget (PIN hashing, balances, stores, locale parity)
flutter analyze
```
