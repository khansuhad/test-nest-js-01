# HISAB247 BACKEND DOCUMENTATION

A production-grade, multi-tenant SaaS POS backend built with NestJS, PostgreSQL (Prisma), and Redis.
Authentication is **verification-only**: JWTs are issued by the NextAuth frontend and consumed here.

---

## 1. System Architecture Overview

```
┌────────────────────────┐         JWT (Bearer)        ┌──────────────────────────────────┐
│  NextAuth Frontend     │ ──────────────────────────▶ │  NestJS Backend (Hisab247)       │
│  (issues JWT)          │                             │  ─ JwtAuthGuard verifies token   │
└────────────────────────┘                             │  ─ Resolves AuthUser onto req    │
                                                       │  ─ StoreIsolationGuard enforces  │
                                                       │     tenant scoping               │
                                                       │  ─ RolesGuard enforces RBAC      │
                                                       └────────────┬─────────────────────┘
                                                                    │
                                            ┌───────────────────────┼──────────────────────┐
                                            │                       │                      │
                                       ┌────▼─────┐           ┌─────▼─────┐         ┌──────▼──────┐
                                       │ Postgres │           │   Redis   │         │  Modules    │
                                       │ (Prisma) │           │ (cache +  │         │  (REST API) │
                                       │          │           │  rate-lim)│         │             │
                                       └──────────┘           └───────────┘         └─────────────┘
```

### Role of each piece

- **NestJS** — modular HTTP layer. Each business domain is a self-contained module (controller, service, DTOs). Global guards/filters/interceptors apply uniformly to every route.
- **PostgreSQL via Prisma** — single source of truth. Schema is multi-tenant: every business row carries `storeId`, indexed for fast tenant-scoped reads. Soft-deletes (`deletedAt`) are honored in all reads.
- **Redis** — high-traffic, expensive endpoints are cache-aside: dashboard overview, finance summary, "user me" lookup. Redis also backs distributed rate-limiting via `@nestjs/throttler`.
- **JWT** — the *only* identity primitive. Backend never issues tokens; it verifies signature + claims (`iss`, `aud`, `alg`) and projects the payload onto `req.user`.

---

## 2. Authentication Flow

```
1. User signs in on the Next.js frontend (NextAuth).
2. NextAuth issues a JWT signed with the shared secret.
   Payload MUST include:  { sub | userId, role, storeId, subscriptionPlan?, iss, aud }
3. Frontend calls the backend:
        Authorization: Bearer <jwt>
4. JwtAuthGuard (global APP_GUARD):
        ─ extracts token from header
        ─ verifies signature, algorithm, issuer, audience, expiry
        ─ normalises claims into AuthUser:
              { userId, email?, role, storeId, subscriptionPlan }
        ─ attaches req.user = AuthUser
5. RolesGuard checks @Roles(...) metadata against req.user.role.
6. StoreIsolationGuard enforces:
        ─ a storeId is present
        ─ any storeId in body/params/query MATCHES req.user.storeId
7. Handler runs. Services use req.user.storeId for every query.
8. Response is wrapped by ResponseInterceptor into a uniform envelope.
```

Required env vars: `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ISSUER`, `JWT_AUDIENCE`. These MUST match the frontend's NextAuth configuration.

Endpoints can opt out of auth with the `@Public()` decorator. By default, **every route is protected**.

---

## 3. Multi-tenant System

Hisab247 is a hard-isolated multi-tenant system. The `storeId` claim on the JWT is the tenant key. There are three layers of defense:

1. **Schema**: every business table (`User`, `Customer`, `Service`, `Finance`, `Subscription`) carries a non-null `storeId` foreign key to `stores(id)`. Composite indexes like `(storeId, createdAt)` and `(storeId, type)` make tenant-scoped scans cheap.
2. **Guard**: `StoreIsolationGuard` runs on every authenticated request. It blocks any request that *attempts* to set `storeId` in body/params/query to a value different from the JWT's `storeId`. This stops naive tampering.
3. **Service layer**: every Prisma query passes `storeId: user.storeId` (or the `@StoreId()` decorator's value) into the `where` clause. There are **no unscoped reads** of business data.

Cache keys also include `storeId` (`dashboard:{storeId}`, `finance:summary:{storeId}`), so cached responses cannot leak across tenants.

---

## 4. Module Explanation

| Module | Responsibility |
| --- | --- |
| **AuthModule** | Provides the verified-JWT `JwtModule` instance to the app. Exposes `GET /auth/me` so the frontend can introspect the resolved principal. No login/signup logic. |
| **UsersModule** | Read-only access to user profiles within the active store. `GET /users/me` is Redis-cached (TTL `CACHE_TTL_USER`). |
| **StoresModule** | Lists/creates stores. Listing is constrained to the principal's store (single-tenant view). Create is `ADMIN`-only. |
| **CustomersModule** | CRUD-light: paginated/searchable list + create. All queries scoped to `storeId`. |
| **ServicesModule** | Catalog of billable services/items (price, tax rate, active flag). |
| **FinanceModule** | Income/expense ledger. Paginated list, create, and a Redis-cached aggregated summary (`GET /finances/summary`). Writes invalidate `finance:summary:{storeId}` and `dashboard:{storeId}`. |
| **SubscriptionsModule** | Per-store subscription status and `upgrade` action. Upserts a `Subscription` row pointing at a `Plan`. |
| **PlansModule** | Read-only plan catalog (FREE / BASIC / PRO / ENTERPRISE). Seeded by `prisma/seed.ts`. |
| **DashboardModule** | Aggregated KPI view: totals, customer/service/user counts, last-7-days income vs expense, recent transactions. Heavily Redis-cached. |

---

## 5. API Documentation

All routes are mounted under the global prefix (default `/api/v1`) and require `Authorization: Bearer <jwt>` unless marked otherwise.

### Auth

#### `GET /auth/me`
Returns the decoded principal.

**Response 200**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "ckxxx",
    "email": "owner@store.com",
    "role": "ADMIN",
    "storeId": "store_abc",
    "subscriptionPlan": "PRO"
  },
  "timestamp": "2026-05-17T12:00:00.000Z"
}
```

### Users

- `GET /users/me` — current user (cached).
- `GET /users/:id` — by id within the active store.

### Stores

- `GET /stores` — the principal's store (single-element list).
- `POST /stores` — `ADMIN`. Body: `{ name, slug, currency?, timezone? }`.

### Customers

- `GET /customers?page=1&limit=20&search=acme` — paginated, optional fuzzy search across name/email/phone.
- `POST /customers` — `ADMIN | MANAGER | CASHIER`. Body: `{ name, email?, phone?, address?, notes? }`.

### Finance

- `GET /finances?page=1&limit=20&type=INCOME&from=2026-01-01&to=2026-12-31&category=sales`
- `POST /finances` — Body:
  ```json
  {
    "type": "INCOME",
    "amount": 199.00,
    "currency": "USD",
    "category": "sales",
    "description": "Invoice #1042",
    "occurredAt": "2026-05-17T10:00:00Z",
    "customerId": "cus_xxx",
    "serviceId": "svc_yyy"
  }
  ```
- `GET /finances/summary` — cached aggregate:
  ```json
  {
    "storeId": "store_abc",
    "totalIncome": 12340.5,
    "totalExpense": 5200.0,
    "netProfit": 7140.5,
    "transactionCount": 312,
    "byCategory": [
      { "category": "sales", "type": "INCOME", "total": 12000 }
    ],
    "generatedAt": "..."
  }
  ```

### Services

- `GET /services?page=1&limit=20&active=true&search=oil` — paginated.
- `POST /services` — `ADMIN | MANAGER`. Body: `{ name, description?, price, taxRate?, isActive? }`.

### Subscriptions

- `GET /subscriptions/status` — current plan + period.
- `POST /subscriptions/upgrade` — `ADMIN`. Body: `{ tier: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE', billingCycle?: 'monthly' | 'yearly' }`.

### Plans

- `GET /plans` — public catalog of active plans.

### Dashboard

- `GET /dashboard/overview` — cached KPI snapshot:
  ```json
  {
    "storeId": "store_abc",
    "kpis": {
      "totalIncome": 12340.5,
      "totalExpense": 5200,
      "netProfit": 7140.5,
      "transactionCount": 312,
      "customerCount": 87,
      "serviceCount": 14,
      "activeUsers": 5
    },
    "last7Days": [
      { "date": "2026-05-11", "income": 200, "expense": 50 }
    ],
    "recentTransactions": [ ... ],
    "generatedAt": "..."
  }
  ```

### Response envelope

All success responses are wrapped by `ResponseInterceptor`:
```json
{ "success": true, "statusCode": 200, "data": <payload>, "meta": <optional>, "timestamp": "..." }
```

All errors are normalised by `HttpExceptionFilter`:
```json
{ "success": false, "statusCode": 400, "path": "/api/v1/...", "method": "POST",
  "timestamp": "...", "error": { "message": "...", "code": "P2002" } }
```

---

## 6. Database Schema Explanation

| Table | Key columns | Purpose |
| --- | --- | --- |
| `stores` | `id`, `slug`, `ownerId`, `currency`, `timezone`, `deletedAt` | Tenant root. Owns all child rows. |
| `users` | `id`, `email`, `role`, `storeId`, `deletedAt` | Cashier/manager/admin accounts pinned to one store. |
| `customers` | `id`, `storeId`, `name`, `email`, `phone`, `createdBy`, `deletedAt` | POS customers. |
| `services` | `id`, `storeId`, `name`, `price (Decimal 14,2)`, `taxRate`, `isActive`, `deletedAt` | Billable catalog items. |
| `finances` | `id`, `storeId`, `type (INCOME/EXPENSE)`, `amount`, `category`, `occurredAt`, `customerId?`, `serviceId?`, `createdBy?` | The ledger. Indexed `(storeId, type)`, `(storeId, occurredAt)`. |
| `plans` | `id`, `tier (unique)`, `priceMonthly`, `priceYearly`, `maxUsers`, `maxCustomers`, `features (Json)` | Plan catalog. Seeded. |
| `subscriptions` | `id`, `storeId (unique)`, `planId`, `status`, `currentPeriodEnd`, `cancelledAt` | One subscription per store. |

**Conventions everywhere**
- `id`: cuid.
- `createdAt`, `updatedAt`: managed by Prisma.
- `deletedAt`: nullable — soft-delete. All service-layer reads filter `deletedAt: null`.
- Indexes: every business table is indexed on `storeId`, on `(storeId, createdAt)`, and on `deletedAt` to keep tenant-scoped paginated queries fast.

**Relations**
- `Store 1—* User`, `Store 1—* Customer`, `Store 1—* Service`, `Store 1—* Finance`, `Store 1—1 Subscription`.
- `Finance *—? Customer`, `Finance *—? Service`, `Finance *—? User (createdBy)` — all `SET NULL` on delete so the ledger remains intact.

---

## 7. Security Model

| Layer | Mechanism | Notes |
| --- | --- | --- |
| Transport | `helmet`, CORS allowlist | Configured in `main.ts`. |
| Rate limiting | `@nestjs/throttler` global guard, configurable via `RATE_LIMIT_TTL_SECONDS` / `RATE_LIMIT_MAX` | Backed by in-memory store; swap to Redis store in production for horizontal scaling. |
| AuthN | `JwtAuthGuard` (global) | Verifies signature, algorithm, issuer, audience, expiry. Rejects on any mismatch. |
| AuthZ (RBAC) | `RolesGuard` + `@Roles(UserRole.ADMIN, ...)` | Per-handler. Missing decorator = any authenticated role. |
| Tenant isolation | `StoreIsolationGuard` + `@StoreId()` decorator + service-layer `storeId` filter | Three layers of defense. |
| Input validation | Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` | DTOs use `class-validator`. Unknown fields are rejected. |
| Output normalisation | `ResponseInterceptor` + `HttpExceptionFilter` | Uniform success / error envelopes. Prisma errors mapped to HTTP codes (`P2002` → 409, `P2025` → 404). |
| Secret handling | All secrets via env. `.env` is gitignored; `.env.example` documents the shape. | |

`req.user` is the **only** trusted source of identity/tenancy. Anything in the body, query, or params claiming a `storeId` is rejected if it differs from the JWT's.

---

## 8. Data Flow Examples

### Create finance entry → invalidate caches
```
POST /finances  { type: INCOME, amount: 199, ... }

  └─▶ JwtAuthGuard verifies token, sets req.user
  └─▶ StoreIsolationGuard verifies no cross-store storeId in body
  └─▶ RolesGuard allows ADMIN|MANAGER|CASHIER
  └─▶ FinanceController.create(dto, user)
       └─▶ FinanceService.create:
              ─ INSERT finance row (storeId = user.storeId)
              ─ DEL  finance:summary:{storeId}
              ─ DEL  dashboard:{storeId}
       └─▶ ResponseInterceptor wraps result in { success, data, ... }
```

### Dashboard request: cache hit vs miss
```
GET /dashboard/overview

  └─▶ Guards as above
  └─▶ DashboardService.overview(storeId)
       └─▶ Redis GET dashboard:{storeId}
             ├─ HIT  → parse JSON, return immediately
             └─ MISS →
                  ─ run summary() (itself Redis-cached under finance:summary:{storeId})
                  ─ COUNT customers / services / active users (parallel)
                  ─ scan last 7 days of finance rows (indexed (storeId, occurredAt))
                  ─ assemble payload
                  ─ Redis SET dashboard:{storeId} EX CACHE_TTL_DASHBOARD
                  ─ return payload
```

---

## 9. Scaling Strategy

### To 10,000 users (~hundreds of stores, low-thousands RPM)

- **Single backend container per region** is sufficient; container is stateless, so horizontal scaling is trivial.
- **Postgres**: managed instance (RDS / Cloud SQL) with read replicas optional. Existing composite indexes (`storeId, createdAt`, `storeId, type`, `storeId, occurredAt`) keep tenant queries on indexed scans.
- **Redis**: single managed instance. Cache TTLs (`CACHE_TTL_DASHBOARD=60`, `CACHE_TTL_FINANCE_SUMMARY=120`) absorb the burst of repeat reads from the dashboard.
- **Rate limiting**: keep default in-memory throttler per instance, or switch to Redis throttler store once you run multiple instances.
- **Observability**: pino logger (already wired), plus the per-request `LoggingInterceptor` (`method url ms user store`). Ship to a log aggregator.

### To 100,000 users (~tens of thousands of stores, sustained traffic)

- **Backend**: run N replicas behind a load balancer. The app holds no session state — JWT verification is local; cache is in Redis.
- **Postgres**:
  - Move read-heavy endpoints (dashboard, finance summary) to **read replicas** via a routed Prisma client.
  - Add **partitioning on `finances`** by `storeId` (hash) or `occurredAt` (range) when row count crosses ~100M.
  - Consider materialised views for the dashboard's daily rollups, refreshed on a cron and served straight to Redis.
- **Redis**: Redis Cluster, with key sharding by `storeId` (already implicit in our keys). Use the **Redis throttler store** so rate limits are global, not per-instance.
- **Write path**:
  - `POST /finances` currently invalidates two cache keys synchronously — keep this; it's cheap.
  - For very high write volumes, move cache invalidation off the request path via a small worker reading a Postgres LISTEN/NOTIFY or an outbox table.
- **Tenant fairness**: enable per-`storeId` throttling (custom `@Throttle` key) so one tenant can't starve others.
- **Schema**: introduce **per-tenant search index** (Postgres GIN on `customers(name)`) if customer search becomes hot.
- **Deployment**: containers deployed via the included `Dockerfile`; orchestrate with Kubernetes or ECS. Migrations are applied at boot (`prisma migrate deploy`) but at 100k-user scale should move to a one-shot CI job to avoid races between replicas.

---

## Appendix: Folder structure

```
src/
  main.ts
  app.module.ts
  config/
    configuration.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  redis/
    redis.module.ts
    redis.service.ts
  common/
    decorators/  (public, roles, current-user, store-id)
    filters/     (http-exception.filter)
    guards/      (jwt-auth, roles, store-isolation)
    interceptors/(logging, response)
    types/       (auth-user)
    utils/       (pagination, cache-keys)
  modules/
    auth/        (controller, module — verification only)
    users/       (controller, service, module)
    stores/      (controller, service, dto, module)
    customers/   (controller, service, dto, module)
    finance/     (controller, service, dto, module)
    services/    (controller, service, dto, module)
    subscriptions/ (controller, service, dto, module)
    plans/       (controller, service, module)
    dashboard/   (controller, service, module)
prisma/
  schema.prisma
  seed.ts
Dockerfile
docker-compose.yml
```
