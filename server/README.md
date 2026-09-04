# Elaraby Connect — API Server + HR Admin Dashboard

باك إند التطبيق + لوحة تحكم HR. Node.js + Express + تخزين JSON ملفي (صفر dependencies أصلية — يشتغل على أي سيرفر فيه Node 18+).

## التشغيل

```bash
cd server
npm install
npm start
```

- **API**:        http://localhost:3000/api/health
- **الأدمن**:     http://localhost:3000/admin/  (`admin` / `elaraby2026` — غيّرها بـ env)

### متغيرات البيئة (اختيارية)

| المتغير | الافتراضي | الوظيفة |
|---|---|---|
| `PORT` | 3000 | منفذ السيرفر |
| `JWT_SECRET` | dev-secret-change-me | توقيع التوكنات — **لازم يتغير في الإنتاج** |
| `ADMIN_USER` / `ADMIN_PASS` | admin / elaraby2026 | دخول الداشبورد |
| `NODE_ENV` | development | في `production` الـ OTP مش بيرجع في الـ response (يتبعت SMS) |

## الداتابيس

`data/db.json` — بتتولد وتتبذر تلقائياً أول تشغيل:
- موظفين: أحمد غنيم (رقم قومي `29001011234592`) + منة عادل — للتجربة فوراً.
- إعلان/أخبار/مزايا/رحلات تجريبية.

لتصفير كل حاجة: وقّف السيرفر، امسح فولدر `data/`، شغّل تاني.

## الـ API (ملخص)

### موظف `/api`
| Endpoint | الوظيفة |
|---|---|
| `POST /auth/otp {nationalId}` | إنشاء OTP (dev بيرجع `devCode`) |
| `POST /auth/otp/verify {nationalId, code}` | تحقق → بيانات الموظف |
| `POST /auth/pin {nationalId, pin}` | تعيين PIN (مُهشَّر scrypt) |
| `POST /auth/pin/verify {nationalId, pin}` | دخول → JWT |
| `POST /auth/pin/change {currentPin, newPin}` | تغيير PIN (Bearer) |
| `GET /me` · `GET /home` | البروفايل · محتوى الهوم |
| `GET /requests` · `POST /requests` · `POST /requests/:id/cancel` | الطلبات (إجازة سنوية بتخصم الرصيد، رفض الرصيد غير الكافي 422) |
| `GET /inbox` · `POST /inbox/read` | الإشعارات |
| `GET /benefits` · `POST /trips/:id/book` · `/unbook` | المزايا وحجز الرحلات |

### أدمن `/api/admin` (Bearer admin token)
| Endpoint | الوظيفة |
|---|---|
| `POST /login` | توكن أدمن |
| `GET /stats` | إحصائيات الداشبورد |
| `GET/POST/PUT /employees` · `POST /employees/:id/toggle` | إدارة الموظفين (+ resetPin) |
| `GET /requests` · `POST /requests/:id/decide {status, reason}` | موافقة/رفض → إشعار فوري للموظف |
| `GET/POST/DELETE /announcements` (ونفس النمط: news, benefits, trips) | المحتوى — إعلان جديد = إشعار جماعي |

## Push Notifications (FCM) — خطوة أخيرة محتاجة حسابك

البنية جاهزة من ناحية السيرفر؛ الناقص إعداد مشروع Firebase (محتاج حساب Google بتاعك):

1. أنشئ مشروع على console.firebase.google.com + تطبيق Android بالـ package `com.elaraby.workforce.elaraby_workforce`.
2. نزّل `google-services.json` وحطه في `android/app/`.
3. أضف `firebase_messaging` للتطبيق + سجّل التوكن على السيرفر (endpoint مقترح: `POST /api/fcm-token {token}`).
4. في السيرفر استخدم Firebase Admin SDK للإرسال عند: قرار على طلب، إعلان جديد، موافقة رحلة.

بدون هذه الخطوة التطبيق شغال طبيعي — الـ Inbox بيسحب الإشعارات عند الفتح (pull)، الفرق الوحيد إن مفيش بوش صغير والشاشة مقفولة.

## النشر على سيرفر حقيقي

1. أي VPS/استضافة Node: انسخ فولدر `server` (بدون `data/` و `node_modules/`)، فعّل `npm ci --omit=dev`، وشغّل بـ `NODE_ENV=production JWT_SECRET=<random> ADMIN_PASS=<قوي> pm2 start server.js` (أو systemd).
2. حط HTTPS فوقه (nginx/caddy reverse proxy + شهادة Let's Encrypt).
3. في التطبيق: `lib/core/network/api_client.dart` → `overrideBaseUrl = 'https://<دومينك>/api'`.
4. للإنتاج الحقيقي استبدل `db.json` بـ PostgreSQL/MySQL (كل القراءة والكتابة عبر `src/db.js` فقط) ووصّل SMS gateway في `POST /auth/otp`.
