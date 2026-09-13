# External Integrations Architecture & Providers

**System:** Elaraby Workforce External Gateways  
**Integration Pattern:** Pluggable Provider Adapter Pattern  
**Supported Domains:** SMS Gateways, Firebase Cloud Messaging (FCM)  
**Modules:** `server/src/integrations/sms/` & `server/src/integrations/push/`  

---

## 1. Provider Adapter Architecture

Elaraby Workforce never couples core business logic to specific external vendor SDKs or endpoints. All external communications flow through abstracted provider interfaces:

```text
[ Core Business Domain ]
 (OTP / Notification)
          │
          ▼
   [ Gateway Factory ]
   (getSmsProvider / getPushProvider)
          │
          ├─────────────────────────────────────────────────┐
          │                                                 │
          ▼                                                 ▼
[ BaseSmsProvider Interface ]                     [ BasePushProvider Interface ]
   ├── CequensSmsProvider (Egypt Default)            ├── FirebasePushProvider (FCM v1 HTTP)
   ├── VodafoneSmsProvider (Egypt Telecom)           └── MockPushProvider (Dev / CI / Staging)
   ├── TwilioSmsProvider (International)
   └── MockSmsProvider (Dev / CI / Staging)
```

---

## 2. SMS Gateway Integration

### 2.1 Provider Configuration Matrix

| Provider | Key Feature | Required Environment Variables |
| :--- | :--- | :--- |
| **Cequens** (Primary Egypt) | Native Egyptian routing, DLR callbacks, brand sender ID | `SMS_PROVIDER=cequens`<br>`CEQUENS_API_KEY`<br>`CEQUENS_SENDER_ID` |
| **Vodafone Egypt** (Secondary Egypt)| High-throughput telecom route, internal factory shortcodes | `SMS_PROVIDER=vodafone`<br>`VODAFONE_SMS_API_URL`<br>`VODAFONE_SMS_ACCOUNT_ID`<br>`VODAFONE_SMS_PASSWORD` |
| **Twilio** (Global Backup) | International branches, global field technicians | `SMS_PROVIDER=twilio`<br>`TWILIO_ACCOUNT_SID`<br>`TWILIO_AUTH_TOKEN`<br>`TWILIO_FROM_NUMBER` |
| **Mock** (Local / CI) | Safe local testing, records outbound messages in memory | `SMS_PROVIDER=mock` (or omitted) |

### 2.2 Egyptian & International Mobile Normalization
All phone numbers are sanitized and normalized before dispatch via `normalizePhoneNumber()`:
* Local Egyptian: `01012345678` ➔ Normalized: `+201012345678`
* Missing country code: `1012345678` ➔ Normalized: `+201012345678`
* International format: `+201012345678` ➔ Preserved intact.
* Invalid digits: Rejected with `ValidationError` before consuming SMS credits.

### 2.3 Provider Fail-Safe Behavior
When provider credentials are unconfigured or unavailable:
* Provider logs a structured warning.
* Does NOT throw unhandled exceptions or crash the API event loop.
* Returns a structured failure payload: `{ success: false, error: 'Provider unconfigured' }`.

---

## 3. Firebase Cloud Messaging (FCM) Integration

### 3.1 Push Notification Capabilities
* Single device targeted notification (direct `token`).
* Multicast batch delivery (up to 500 device tokens per HTTP payload).
* Topic subscription broadcasting (e.g. `company-announcements`, `factory-monofeya-alerts`).
* Automatic invalid token pruning: When Google FCM returns `UNREGISTERED` or `INVALID_ARGUMENT`, the provider marks the device token as invalid to prevent wasted push requests.

### 3.2 FCM Production Configuration
Production requires Google Service Account JSON configuration:
```env
PUSH_PROVIDER=firebase
FIREBASE_PROJECT_ID=elaraby-workforce-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@elaraby-workforce-prod.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----\n"
```
If credentials are not present, `FirebasePushProvider` gracefully rejects dispatch with status `unconfigured` without crashing.
