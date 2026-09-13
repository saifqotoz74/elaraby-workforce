# Elaraby Connect — System Architecture & Design Specification

**Application:** Elaraby Connect (Workforce Management Platform)  
**Target Platform:** Mobile (Android & iOS) + Microservice Backend (Node.js/Express)  
**Version:** 1.0.0 (Production Architecture)  
**Date:** September 2026  

---

## 1. High-Level Architecture Overview

Elaraby Connect employs an **offline-first Clean Architecture** pattern tailored for high-concurrency workforce operations across manufacturing plants. The mobile application provides instantaneous local responsiveness for factory shift workers, gracefully degrading during network drops, and automatically synchronizing when connectivity is restored.

```mermaid
graph TD
    subgraph "Clients"
        Mobile[Flutter Mobile Client - Android & iOS]
        Web[Admin Dashboard SPA]
    end

    subgraph "API / Backend: Modular Monolith"
        Express[Express API Gateway & Controllers]
        AuthMW[Auth, RBAC & Scope Guard]
        Services[Application Services]
        RepoLayer[Repository Layer & Interfaces]
    end

    subgraph "Primary Storage"
        PG[(PostgreSQL Primary DB - ACID, Pooled)]
    end

    subgraph "Distributed State & Queuing"
        Redis[(Redis 7 - Caching, Distributed Locks, RateLimit, PubSub)]
        BullWorker[BullMQ Background Workers]
    end

    subgraph "Integration Adapters"
        SMSAdapter[SMS Gateway Adapter: Twilio / Cequens / Vodafone / Mock]
        PushAdapter[FCM Push Adapter: Firebase HTTP v1 / Mock]
        ERPAdapter[ERP Adapter: SAP / Oracle / REST / Mock]
        BioAdapter[Biometric Time-Clock Adapter: REST / CSV-SFTP / Mock]
    end

    subgraph "Observability Layer"
        APM[Structured JSON Logger, Request IDs, Metrics, Health Probes]
    end

    Mobile --> Express
    Web --> Express
    Express --> AuthMW
    AuthMW --> Services
    Services --> RepoLayer
    RepoLayer --> PG
    Services --> Redis
    Services --> BullWorker
    BullWorker --> Redis
    BullWorker --> PG
    BullWorker --> SMSAdapter
    BullWorker --> PushAdapter
    BullWorker --> ERPAdapter
    BullWorker --> BioAdapter
    Express --> APM
    BullWorker --> APM
```

---

## 2. Mobile Architecture & Layering

### 2.1 Feature-First Directory Structure

The codebase is organized by business feature domains to maximize cohesion and minimize cross-boundary coupling:

```
lib/
├── core/
│   ├── data_sources/      # Local and remote low-level abstractions
│   ├── errors/            # Typed domain error hierarchy (AppError)
│   ├── localization/      # Bilingual localization engine & AppLocale
│   ├── navigation/        # Declarative GoRouter configuration & route guards
│   ├── network/           # ApiClient, Backend facade, ConnectivityService, PushService
│   ├── providers/         # Global Riverpod repository & client providers
│   ├── repositories/      # Repository interfaces and implementations
│   ├── state/             # Robust UiState state machine
│   ├── storage/           # LocalStore (SharedPreferences + SecureStorage)
│   ├── theme/             # AppTheme (Light & Factory Night Dark), AppColors, AppTypography
│   └── utils/             # Debouncer, EgyptianNationalIdValidator, UiFeedback
├── features/
│   ├── auth/              # National ID, OTP, PIN creation, Lock screens & controllers
│   ├── home/              # Dashboard, metric cards, today shift, news, announcements
│   ├── services/          # Vacation balance, salary slip, leave requests, concerns, shift schedule
│   ├── benefits/          # Corporate discounts catalog, summer trip booking & cancellations
│   ├── inbox/             # Push notifications inbox & read state tracking
│   ├── profile/           # Employee details, biometric settings, dark mode, PIN change
│   └── main_navigation/   # 4-tab bottom navigation shell with offline status banner
└── l10n/                  # ARB source translation files (app_en.arb, app_ar.arb)
```

---

## 3. State Management Architecture

### 3.1 Riverpod & StateNotifier Pattern

State management is powered by `flutter_riverpod`, separating business logic from rendering:

* **Separation of Concerns:** Screens extend `ConsumerWidget` or `ConsumerStatefulWidget` and observe controllers via `ref.watch(provider)`.
* **Predictable State Transitions:** Controllers extend `StateNotifier<UiState<T>>`, transitioning strictly through predefined lifecycle states:
  * `UiState.loading()`: Initial fetch or active computation.
  * `UiState.success(data)`: Valid state containing verified domain entities.
  * `UiState.empty()`: Successful query with no records (e.g. no pending requests).
  * `UiState.error(message, [cause])`: Explicit failure with user-facing messages (zero silent null returns).
  * `UiState.refreshing(previousData)`: Background refresh preserving active UI data.
  * `UiState.offline(cachedData)`: Device offline while presenting cached records.

```mermaid
stateDiagram-v2
    [*] --> Loading: Initial Load
    Loading --> Success: Data Received
    Loading --> Empty: Zero Records
    Loading --> Offline: Network Disconnected (Cached)
    Loading --> Error: Server / Parsing Failure
    Success --> Refreshing: Pull to Refresh
    Refreshing --> Success: Refreshed Data
    Refreshing --> Offline: Network Lost (Preserve Cache)
    Error --> Loading: User Taps Retry
```

---

## 4. Navigation Architecture

### 4.1 Declarative Routing with GoRouter

Navigation is declared in `AppRouter` using `GoRouter`:

* **Single Source of Truth:** Route paths are centralized in `AppRoutes` (e.g. `/`, `/get-started`, `/national-id`, `/main`, `/salary-slip`).
* **Route Guards & Protection:** `AppRouter.redirect` evaluates `AppAuthState` (authenticated vs locked vs unonboarded) on every route evaluation. Unauthenticated attempts to access `/main` or `/salary-slip` are immediately redirected to `/lock` or `/get-started`.
* **Deep Linking & Fallback:** Unknown paths are caught and rendered via `UnknownRouteScreen` (HTTP 404 equivalent).

---

## 5. Offline-First Resilience Architecture

### 5.1 Real Hardware Connectivity Detection
Rather than misinterpreting transient HTTP timeouts as offline mode, the client uses `ConnectivityService` backed by `connectivity_plus`.

### 5.2 Optimistic Offline Queueing & Rollback
1. When submitting a request while offline:
   - Request is assigned a unique local ID (`req_REQ-2026-TEMP...`).
   - Marked with `isPendingSync = true`.
   - Saved locally into `LocalStore` and inserted into `RequestsStore`.
   - Annual leave days are optimistically deducted so the employee cannot over-request.
2. When connectivity is restored:
   - `ConnectivityService` emits an online event.
   - `RequestsStore.instance.flushPending()` is triggered automatically.
   - Requests are processed idempotently by the server (`x-idempotency-key`).
   - If rejected by business policy (e.g. balance exceeded), the deducted days are automatically refunded and the request is marked `rejected`.

---

## 6. Secure Storage & Credential Architecture

* **Hardware Keystore:** Critical security data (PIN hashes, session JWTs) are managed via `FlutterSecureStorage` backed by Android KeyStore (AES-256 GCM) and iOS Keychain (`kSecAccessControlBiometryAny` / `first_unlock`).
* **Plaintext Exclusion:** Plaintext PINs and raw tokens are never written to `SharedPreferences` or logged to disk.
* **Session Teardown:** Unified logout (`Backend.instance.clearAllUserData()`) clears all storage caches, resets vacation balance, wipes in-memory stores, and unregisters push tokens.
 
---
 
+## 7. Enterprise Backend & Distributed Architecture
+
+### 7.1 Modular Monolith + BullMQ Workers Design
+To eliminate operational complexity while scaling to tens of thousands of employees:
+* **Modular Monolith Core:** Domain modules (Employee, Leave, Shift, Payroll, Benefits, Content, Audit) are organized with clear boundaries. Controllers delegate to application services, which interact with clean repository interfaces.
+* **Authoritative Persistence:** PostgreSQL acts as the single authoritative source of truth. Connection pooling is managed via `pg.Pool` with parameterized queries, statement timeouts, and transactional integrity.
+* **Distributed Cache & State:** Redis 7 provides non-permanent state management:
+  * Ephemeral OTP storage (`SETEX`) with TTL
+  * Distributed rate-limiting and lockout enforcement
+  * Idempotency key tracking
+  * Cluster Pub/Sub bridging Server-Sent Events across multiple API instances
+* **Background Job Processing:** Long-running, external, and batch operations are decoupled from HTTP request loops into **BullMQ** workers:
+  * `sms`: Critical OTP and transactional SMS with exponential backoff
+  * `push`: Firebase Cloud Messaging delivery and invalid token cleanup
+  * `notifications`: Bulk announcement dispatches
+  * `payroll`: Statement preparation and heavy calculations
+  * `erp-sync`: Asynchronous SAP / Oracle / REST synchronization
+  * `attendance-sync`: Biometric ingestion, normalization, and reconciliation
+* **Integration Boundary:** Pluggable adapter architecture isolating third-party vendors (SMS gateways, push providers, ERPs, biometric clocks) behind strict contracts, enabling Mock implementations in test/dev and zero hardcoded credentials.
+* **Comprehensive Observability:** Uniform correlation IDs (`x-request-id`), structured JSON logging with automated PII/credential scrubbing, pluggable error reporting, Prometheus metrics, and Kubernetes-grade health/readiness/liveness probes.

