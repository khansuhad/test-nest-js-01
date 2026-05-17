# Hisab247 — Postman Quickstart

Get from a fresh clone to "I'm calling the API from Postman" in under 5 minutes.

---

## 1. Choose how you'll run it

### A. LOCAL mode (NestJS on your host, Postgres+Redis in Docker)

1. Boot only the infrastructure containers:
   ```powershell
   docker compose up -d postgres redis
   ```
2. Ensure your `.env` is the LOCAL one (already shipped with `localhost` hostnames):
   ```
   DATABASE_URL=postgresql://hisab247:hisab247@localhost:5432/hisab247?schema=public
   REDIS_HOST=localhost
   ```
3. Apply the schema, seed the test data, mint a JWT, run NestJS:
   ```powershell
   npm install
   npx prisma migrate deploy      # (or: npx prisma db push for first-time setup)
   npm run prisma:seed
   npm run token
   npm run start:dev
   ```

### B. DOCKER mode (everything in containers)

1. Copy the docker env template:
   ```powershell
   cp .env.docker.example .env.docker
   ```
   Edit `JWT_SECRET` inside `.env.docker`.
2. Build and run:
   ```powershell
   docker compose --env-file .env.docker up --build
   ```
   The backend container runs `prisma migrate deploy && prisma db seed && node dist/main.js`.
3. To mint a JWT against the running stack:
   ```powershell
   docker compose exec backend npx ts-node scripts/issue-test-token.ts
   ```
   (or run it from your host once you have `.env` pointed at `localhost`).

---

## 2. The seeded test user

The seed creates a deterministic, idempotent test record set:

| Field      | Value                                              |
| ---------- | -------------------------------------------------- |
| Mobile     | `01700000001`                                      |
| Password   | `Test@1234`                                        |
| Role       | `ADMIN`                                            |
| Store name | `Test POS Store`                                   |
| Store publicId | `100001`                                       |
| Plan       | `PRO` (active)                                     |
| Sample customer publicId | `200001`                             |
| Sample service publicId  | `300001`                             |
| Sample finance publicIds | `400001` (income), `400002` (expense) |

---

## 3. Get your bearer token

```powershell
npm run token
```

You'll see something like:

```
=========== HISAB247 TEST JWT ===========
User:        Test Owner (ADMIN)
Store:       Test POS Store  [clxxxxx...]
Public ID:   100001
Plan:        PRO
Expires in:  24h
-----------------------------------------

Authorization header (copy/paste into Postman):

Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

In Postman: open any request → **Authorization** tab → **Type: Bearer Token** → paste the raw token.
Or set it on a **Collection** so every request inherits it.

For a longer-lived token: `npm run token -- 7d`.

---

## 4. Sanity-check curl

```powershell
$BASE = "http://localhost:3000/api/v1"
$TOKEN = "<paste the raw token here>"

curl -H "Authorization: Bearer $TOKEN" $BASE/auth/users/session
```

Expected:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "clx...",
    "email": "owner@test-pos.com",
    "mobile": "01700000001",
    "role": "ADMIN",
    "storeId": "clx...",
    "subscriptionPlan": "PRO"
  },
  "timestamp": "2026-05-17T..."
}
```

---

## 5. Endpoint cheat sheet

Base URL: `http://localhost:3000/api/v1`

### Auth & users

| Method | Path                          | Notes                          |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/auth/users/session`         | Decoded JWT principal          |
| GET    | `/auth/users/store-access`    | `{ hasAccess, role, storeId }` |
| GET    | `/auth/me`                    | Legacy alias                   |
| GET    | `/users/me`                   | Cached user record             |

### Stores

| Method | Path                  | Notes                                |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/stores/management`  | Active store profile + subscription  |
| POST   | `/stores/management`  | Upsert store profile (ADMIN)         |
| GET    | `/stores/devices`     | Trusted devices list (ADMIN/MANAGER) |

### Customers

| Method | Path                            | Notes                              |
| ------ | ------------------------------- | ---------------------------------- |
| GET    | `/customers/management`         | Paginated, `?search=&page=&limit=` |
| POST   | `/customers/management`         | Create                             |
| GET    | `/customers/management/:id`     | Lookup by id or publicId           |
| PUT    | `/customers/management/:id`     | Update                             |
| DELETE | `/customers/management/:id`     | Soft delete                        |

Example POST body:
```json
{
  "name": "New Customer",
  "phone": "01988887777",
  "email": "new@example.com",
  "city": "Dhaka",
  "address": "Banani 11"
}
```

### Services (repair jobs)

| Method | Path                              | Notes                                |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/services`                       | Paginated list                       |
| POST   | `/services/management`            | Create job                           |
| GET    | `/services/management/list`       | Lightweight list                     |
| PUT    | `/services/management/:id`        | Update status, finalPrice, etc.      |
| GET    | `/services/service-payments?serviceId=ID` | Payment history for a job    |

Example POST body:
```json
{
  "name": "Battery Replacement",
  "number": "01911111111",
  "model": "Samsung S24 Ultra",
  "problem": "Battery drains in 2 hours",
  "price": 6500,
  "partsCost": 4000,
  "advancedAmount": 1000,
  "status": "RECEIVED"
}
```

### Finance

| Method | Path                                          | Notes                                       |
| ------ | --------------------------------------------- | ------------------------------------------- |
| GET    | `/finances/general-finances/list`             | Cash-flow entries (affectType contains cash)|
| POST   | `/finances/general-finances/management`       | Create cash entry                           |
| GET    | `/finances/expenses/list`                     | Expense entries (affectType contains profit)|
| POST   | `/finances/expenses/management`               | Create expense (ADMIN/MANAGER)              |
| GET    | `/finances/:id`                               | Single entry by id/publicId                 |
| DELETE | `/finances/:id`                               | Soft delete (ADMIN/MANAGER)                 |
| GET    | `/finances/balance/cash-balance`              | Cash-in-hand snapshot                       |
| GET    | `/finances/analytics/stats`                   | Aggregated summary (cached 120s)            |
| GET    | `/finances/categories`                        | Defaults + custom merged                    |
| POST   | `/finances/categories`                        | Create custom category (ADMIN)              |
| DELETE | `/finances/categories/:id`                    | Delete custom category (ADMIN)              |

Example POST body (general finance):
```json
{
  "type": "INCOME",
  "amount": 2500,
  "category": "cash_in",
  "subcategory": "owner_investment",
  "affectType": "cash",
  "notes": "Added working cash"
}
```

### Plans & subscriptions

| Method | Path                                | Notes                                 |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | `/plans/management`                 | Public catalog                        |
| GET    | `/plans/status`                     | Active plan + usage counters          |
| POST   | `/subscriptions/management`         | Upgrade plan (ADMIN)                  |
| GET    | `/subscriptions/check-limit?resource=maxJobsPerMonth` | Quota check     |
| GET    | `/subscriptions/status`             | Same as plans/status without usage    |

Example upgrade body:
```json
{ "tier": "ENTERPRISE", "billingCycle": "yearly" }
```

### Dashboard

| Method | Path                                | Notes                              |
| ------ | ----------------------------------- | ---------------------------------- |
| GET    | `/dashboard/analytics/optimized`    | Cached KPI snapshot (60s)          |
| GET    | `/dashboard/analytics/summery`      | Spec alias (legacy typo)           |
| GET    | `/dashboard/overview`               | Legacy alias                       |

### Swagger UI

While `NODE_ENV !== 'production'`, browse the live OpenAPI explorer at:

```
http://localhost:3000/api/v1/docs
```

---

## 6. Response envelope

Every success response:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Optional headline (when handler returns { message, data })",
  "data": <payload>,
  "meta": <optional pagination/etc>,
  "timestamp": "ISO timestamp"
}
```

Every failure response:
```json
{
  "success": false,
  "statusCode": 4xx,
  "path": "/api/v1/...",
  "method": "POST",
  "timestamp": "...",
  "error": { "message": "...", "code": "P2002" }
}
```

---

## 7. Common gotchas

* **Stale TS errors after schema change** — run `npx prisma generate`, then in VSCode press `Ctrl+Shift+P` → `TypeScript: Restart TS Server`.
* **`Can't reach database server at postgres:5432`** when running `npm run start:dev` — your `.env` is in DOCKER mode. Switch hostnames back to `localhost`.
* **`Can't reach localhost:5432` inside the backend container** — your container is reading host env. Use the docker-compose env values (the file ships these explicitly).
* **`P1012 Environment variable not found: DATABASE_URL`** — `.env` is missing or not in the project root. Copy `.env.example` to `.env`.
* **`401 Unauthorized` on every call** — your token expired (default 24h). Run `npm run token` again.
