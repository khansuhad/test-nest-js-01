# HISAB247: Full API Migration Specification & Database Schema Map
## From Next.js (MongoDB + Redis) to NestJS (PostgreSQL/Prisma + Redis)

This specification serves as the authoritative, production-grade guide for developers migrating the backend APIs of **Hisab247** from a serverless Next.js App Router architecture (utilizing MongoDB and Upstash Redis) to a robust, highly performant NestJS monolithic backend backed by PostgreSQL (via Prisma ORM) and Redis.

---

## 1. System Identity, Multi-Tenancy & Security Model

### 1.1 The Multi-Tenancy Model (Hard-Isolated Tenant Scoping)
Hisab247 operates on a shared-database, shared-schema multi-tenant architecture. 
* **Tenant Key**: Every tenant is identified by a unique `storeId`.
* **Database Controllability**: Every business table/collection (`User`, `Customer`, `Service`, `Finance`, `Subscription`, `FinanceCategory`) **MUST** store and query with `storeId` explicitly.
* **Three-Layer Security Defense**:
  1. **Prisma Schema Constraints**: All multi-tenant models have foreign-key relationships to `Store` and composite indexes on `(storeId, createdAt)` or `(storeId, type)` to guarantee performant, scoped scans.
  2. **Store Isolation Guard (`StoreIsolationGuard`)**: Intercepts all incoming requests. It checks that the user's JWT contains a `storeId` and verifies that any `storeId` passed in parameters (`req.params.storeId`), query (`req.query.storeId`), or body (`req.body.storeId`) matches the JWT-issued `storeId` exactly. If there is a mismatch, the request is immediately blocked (HTTP 403).
  3. **Service Layer Isolation**: The `storeId` is fed directly into all Prisma queries. There are absolutely **no unscoped database queries** for business transactions.

### 1.2 Authentication Primitive (NextAuth Verification-Only)
* **Verify-Only Backend**: The NestJS backend does **not** issue JWTs. All authentication tokens are issued by the Next.js frontend (via NextAuth.js using a shared secret).
* **JWT Schema Verification**: The backend verifies incoming bearer tokens (`Authorization: Bearer <jwt>`) against:
  - Signature validation (using `JWT_SECRET`)
  - Algorithm check (e.g. `HS256`)
  - Expiry checks (`exp`)
  - Claims normalisation onto `req.user` (`AuthUser` payload):
    ```typescript
    export interface AuthUser {
      userId: string;
      email?: string;
      mobile: string;
      role: 'ADMIN' | 'MANAGER' | 'CASHIER';
      storeId: string;
      subscriptionPlan?: string;
    }
    ```

---

## 2. Environment Variables & System Configuration

Configure your NestJS `.env` with these exact keys, derived from the Next.js configurations:

```ini
# --- Application Config ---
PORT=3001
NODE_ENV=production
API_PREFIX=api/v1

# --- Databases ---
# PostgreSQL Connection URL
DATABASE_URL="postgresql://postgres:password@localhost:5432/hisab247?schema=public"

# Redis Config (Used for Caching, Rate-Limiting, and OTP tracking)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
# Or for Upstash Redis:
REDIS_URL="redis://default:password@region.upstash.io:6379"

# --- Security & Auth (Shared with Next.js Frontend) ---
JWT_SECRET="your_shared_nextauth_jwt_secret_here"
JWT_ALGORITHM="HS256"
JWT_ISSUER="hisab247.com"
JWT_AUDIENCE="store.hisab247.com"

# --- SMS Gateway Config (Centralized SMS) ---
SMS_GATEWAY_URL="https://api.sms_provider.com/send"
SMS_API_KEY="your_sms_gateway_api_key_here"
SMS_SENDER_ID="HISAB247"

# --- Cache TTL Configurations (in seconds) ---
CACHE_TTL_USER=300
CACHE_TTL_DASHBOARD=60
CACHE_TTL_FINANCE_SUMMARY=120
```

---

## 3. Database Collection Map & PostgreSQL Model Translation

### 3.1 MongoDB Collections to PostgreSQL (Prisma) Schema Mapping

The following tables show exactly how the original MongoDB collections, fields, and types map to PostgreSQL models managed via Prisma:

#### A. Users Collection (`users`)
Used to store users, verify accounts, and associate super-admins/cashiers with stores.
* **MongoDB Representation**:
  - `_id` (ObjectId)
  - `name` (string)
  - `mobile` (string, unique global)
  - `email` (string)
  - `password` (hashed string)
  - `role` (string: "store super admin", "store manager", "cashier")
  - `isActive` (string: "active", "suspended")
  - `isVerified` (boolean)
  - `storeId` (string, optional - links to store)
  - `profilePhoto` (string)
  - `createdAt` (Date)
  - `updatedAt` (Date)
* **PostgreSQL (Prisma) Translation**:
  - Map `_id` to CUID (`String @id @default(cuid())`)
  - Map role to enum `UserRole` (`ADMIN`, `MANAGER`, `CASHIER`)
  - Link to `Store` model using `storeId` foreign key (cascade delete).

#### B. Stores Collection (`stores`)
Holds metadata and login device profiles for each business tenant.
* **MongoDB Representation**:
  - `_id` (ObjectId)
  - `storeId` (string - public random 6-digit identifier)
  - `name` (string)
  - `ownerId` (string/ObjectId - links to owner user)
  - `businessType` (string: "mobile_service", etc.)
  - `isVerified` (boolean)
  - `status` (string: "active", "suspended")
  - `planId` (string - links to plans)
  - `subscriptionId` (string)
  - `contact` (embedded object: `phone`, `email`, `address`)
  - `devicesLogin` (embedded array of `DeviceLoginInfo` objects)
  - `createdAt` (Date)
  - `updatedAt` (Date)
* **PostgreSQL (Prisma) Translation**:
  - Flatten embedded structures!
  - `contact` embedded object fields map directly to columns: `email String?`, `phone String?`, `address String?`.
  - Move `devicesLogin` to a separate `DeviceLogin` table linked via foreign key to `Store`.

#### C. Customers Collection (`customers`)
Stores store-specific customer files.
* **MongoDB Representation**:
  - `_id` (ObjectId)
  - `customerId` (string - random 6-digit public ID)
  - `storeId` (string - tenant filter)
  - `name` (string)
  - `email` (string)
  - `phone` (string)
  - `address` (string)
  - `city` (string)
  - `createdAt` (Date)
  - `updatedAt` (Date)
* **PostgreSQL (Prisma) Translation**:
  - Map to `Customer` table. Include `deletedAt` for soft-deletion logic.

#### D. Services Collection (`services`)
Stores repair/service jobs, tracking work progress, price, costs, payments, and discounts.
* **MongoDB Representation**:
  - `_id` (ObjectId)
  - `serviceId` (string - random 6-digit public ID)
  - `storeId` (string)
  - `name` (string)
  - `number` (string - customer contact mobile)
  - `model` (string - device model, e.g. "iPhone 15 Pro")
  - `problem` (string - description of defect)
  - `status` (string: "pending", "received", "in_progress", "ready", "delivered", "cancelled")
  - `price` (number)
  - `partsCost` (number)
  - `discount` (number)
  - `totalPaid` (number - calculated from finance records on GET, updated on PUT)
  - `advancedAmount` (number)
  - `finalPrice` (number)
  - `createdAt` (Date)
  - `updatedAt` (Date)
* **PostgreSQL (Prisma) Translation**:
  - Map to `Service` table. Map monetary numbers to `Decimal(14,2)` for financial safety.

#### E. Finances Collection (`finances`)
The primary transactional ledger. Stores cash flows, service payments, operating expenses, and cash in/out.
* **MongoDB Representation**:
  - `_id` (ObjectId)
  - `invoiceId` (string - random 6-digit public ID)
  - `storeId` (string)
  - `amount` (number)
  - `category` (string - e.g., "service_payment", "operating_expenses", "cash_in")
  - `subcategory` (string - e.g., "advanced_payment", "rent", "owner_investment")
  - `paymentType` (string: "income", "expense")
  - `date` (Date)
  - `notes` (string, optional)
  - `affectType` (array of strings: "profit" and/or "cash")
  - `additionalInfo` (embedded object: `serviceId`, `customerName`, `customerPhone`)
  - `createdAt` (Date)
  - `updatedAt` (Date)
* **PostgreSQL (Prisma) Translation**:
  - Map to `Finance` table. Flatten `additionalInfo` into nullable relations or direct fields: `serviceId String?`, `customerName String?`, `customerPhone String?`.
  - Store `affectType` arrays either as Postgres Enums or simple tags array.

#### F. Plans (`plans`) & Subscriptions (`subscriptions`)
Manages SaaS billing, packaging, and limits.
* **MongoDB Representation**:
  - `plans` contain: `_id`, `planType` ("default", "basic", "premium"), `name`, `maxCustomers`, `maxJobsPerMonth`, `priceMonthly`, etc.
  - `subscriptions` contain: `_id`, `storeId`, `planId`, `status`, `startedAt`, `currentPeriodEnd`.
* **PostgreSQL (Prisma) Translation**:
  - Maps to `Plan` and `Subscription` tables with CUID primary keys, aligned with enums.

---

### 3.2 Index Translation Specs: MongoDB to PostgreSQL
To achieve parity with MongoDB index performance, the PostgreSQL database must implement equivalent composite indexes in Prisma:

| Collection / Target | MongoDB Indexes | PostgreSQL/Prisma `schema.prisma` Equivalent |
| :--- | :--- | :--- |
| **Finances (`finances`)** | `storeId: 1`, `affectType: 1`, `createdAt: -1` | `@@index([storeId, affectType, createdAt(sort: Desc)])` |
| | `storeId: 1`, `affectType: 1`, `paymentType: 1` | `@@index([storeId, affectType, paymentType])` |
| | `storeId: 1`, `paymentType: 1`, `createdAt: -1` | `@@index([storeId, paymentType, createdAt(sort: Desc)])` |
| | `storeId: 1`, `additionalInfo.serviceId: 1` | `@@index([storeId, serviceId])` |
| | `storeId: 1`, `date: -1` | `@@index([storeId, date(sort: Desc)])` |
| | `storeId: 1`, `category: 1`, `createdAt: -1` | `@@index([storeId, category, createdAt(sort: Desc)])` |
| **Services (`services`)** | `storeId: 1`, `status: 1`, `createdAt: -1` | `@@index([storeId, status, createdAt(sort: Desc)])` |
| | `storeId: 1`, `serviceId: 1` | `@@index([storeId, serviceId])` |
| | `storeId: 1`, `status: 1`, `price: 1`, `totalPaid: 1`, `discount: 1` | `@@index([storeId, status, price, totalPaid, discount])` |
| **Expenses (`expenses`)* | `storeId: 1`, `createdAt: -1` | Merged under Finances indexes. |
| **Customers (`customers`)**| `storeId: 1`, `createdAt: -1` | `@@index([storeId, createdAt(sort: Desc)])` |

---

## 4. Key Security & Verification Logic (Re-implemented in NestJS)

### 4.1 Enhanced OTP Generation & Secure Hash Verification
1. **Generation**: Plain OTPs are 6-digit numeric codes generated via `Math.floor(100000 + Math.random() * 900000).toString()`.
2. **Hashing**: To prevent database leakage, plain OTPs are never stored. The plain OTP is hashed using SHA256 (`crypto.createHash("sha256").update(otp).digest("hex")`) before storage.
3. **Storage & Expiry**: Saved in Redis under key `otp:${mobile}` with a strict TTL of `150 seconds` (2 mins 30s). The value stored is:
   ```json
   {
     "otp": "SHA256_HASHED_VAL",
     "attempts": 0,
     "createdAt": 1715963316000,
     "mobile": "017XXXXXXXX",
     "deviceId": "DEVICE_IDENTIFIER"
   }
   ```
4. **Attempt Limits**: Maximum verification attempts per OTP code is **5**. If `attempts >= 5`, the Redis key `otp:${mobile}` is deleted immediately.

### 4.2 OTP Rate Limiting Rules (Redis-backed Throttler)
Every time `/api/auth/otp/send-otp` or `/api/auth/otp/verify-otp` is requested, the system validates rate limits across 3 entities:
* **OTP Sending Window** (Rate limit window: 5 minutes = 300 seconds):
  - **Mobile Limit**: Maximum **3** requests per 5 minutes per mobile number. (Redis Key: `otp:send:mobile:${mobile}`)
  - **IP Limit**: Maximum **10** requests per 5 minutes per IP address. (Redis Key: `otp:send:ip:${ip}`)
  - **Device Limit**: Maximum **3** requests per 5 minutes per device token. (Redis Key: `otp:send:device:${deviceToken}`)
* **OTP Verification Window**:
  - **Mobile Limit**: Maximum **5** attempts per 5 minutes.
  - **IP Limit**: Maximum **15** attempts per 5 minutes.
  - **Device Limit**: Maximum **5** attempts per 5 minutes.

### 4.3 OTP Resend Cooldown & Flow Limits
* **Resend Cooldown**: A strict 60-second cooldown is enforced between subsequent resend requests. The system sets the key `resend:${mobile}:${deviceToken}` for 60 seconds.
* **Flow Cap**: For high-risk flows (`signup` and `reset`), the system enforces a hard limit of **3 resends per 24 hours**. Tracked in Redis via `resend_limit:${flow}:${mobile}:${deviceToken}` with a TTL of 86400 seconds.

### 4.4 Bot & Crawl Protection (`protectOTPEndpoint`)
For OTP endpoints, check requests for structural headers (User-Agent, client IPs) and enforce rate-limiting. A customized NestJS Guard (`BotProtectionGuard`) should check if the IP is blocked or if the request payload pattern matches typical bot behaviors.

---

## 5. Detailed API Endpoint Specification (All 46 Next.js Endpoints)

Below is the complete, comprehensive list of all Next.js API routes that need to be migrated, grouped into logical modules. Each route includes its exact parameters, payloads, internal rules, and expected response payloads.

---

### Module 5.1: Authentication & OTP Gateways (11 Endpoints)

#### 1. Send OTP
* **Route**: `POST /api/auth/otp/send-otp`
* **Access**: Public
* **Payload**:
  ```json
  {
    "mobile": "017XXXXXXXX",
    "storeId": "Optional (used for device verification on login)",
    "deviceId": "Optional",
    "deviceToken": "Strict UUID format (e.g. 550e8400-e29b-41d4-a716-446655440000)"
  }
  ```
* **Internal Logic**:
  1. Read IP from `x-forwarded-for` or `cf-connecting-ip`. Validate device token format.
  2. Determine flow purpose (`device-verification` if `storeId` is present, `login`, `signup`, or `forgot-password`).
  3. Validate IP/Mobile/Device against send rate limits and resend cooldowns.
  4. Generate random 6-digit OTP. Hashed and saved in Redis under `otp:${mobile}`.
  5. Trigger SMS Gateway via integrated `smsService` (e.g., using `SMS_TEMPLATES.verification`).
  6. Mark OTP as sent in Redis resend cooldown (`resend:${mobile}:${deviceToken}`) for 60 seconds.
* **Success Response (200)**:
  ```json
  { "success": true, "message": "OTP sent successfully. Please check your mobile." }
  ```
* **Error Response (429 / 400)**:
  ```json
  { "success": false, "message": "Please wait 45 seconds before requesting another OTP", "timeRemaining": 45 }
  ```

#### 2. Verify OTP
* **Route**: `POST /api/auth/otp/verify-otp`
* **Access**: Public
* **Payload**:
  ```json
  {
    "mobile": "017XXXXXXXX",
    "otp": "123456",
    "deviceToken": "UUID-String"
  }
  ```
* **Internal Logic**:
  1. Retrieve OTP record from Redis key `otp:${mobile}`.
  2. Check attempts count. If attempts >= 5, fail immediately and delete OTP key.
  3. Hash incoming `otp` and compare with stored hash. If incorrect, increment attempts, return remaining attempts count.
  4. If correct, delete `otp:${mobile}` from Redis, return success.
* **Success Response (200)**:
  ```json
  { "success": true, "message": "OTP verified successfully. You can now login." }
  ```

#### 3. Complete Sign-In (OTP flow)
* **Route**: `POST /api/auth/otp/complete-signin`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "deviceToken": "UUID-String" }`
* **Internal Logic**: Used to complete OTP flow. Verifies that the mobile number completed OTP verification within the last 5 minutes. Creates a temporary session token or returns success code allowing frontend NextAuth to complete sign-in.

#### 4. Sign Up With OTP
* **Route**: `POST /api/auth/otp/signup-with-otp`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "name": "User Name", "password": "securepassword", "deviceToken": "UUID-String" }`
* **Internal Logic**: Creates a new user in the PostgreSQL database. Password MUST be hashed with Bcrypt (cost factor 10). Sets `isVerified = true`. Role defaults to `ADMIN`. Returns user creation metadata.

#### 5. Create Store After OTP
* **Route**: `POST /api/auth/otp/create-store-after-otp`
* **Access**: Public (requires valid verified user session/payload)
* **Payload**:
  ```json
  {
    "userId": "cuid_user_id",
    "storeName": "My Mobile Repair POS",
    "mobile": "017XXXXXXXX",
    "email": "owner@store.com"
  }
  ```
* **Internal Logic**:
  1. Verify user exists and is verified, but does not yet possess a `storeId`.
  2. Generate a random 6-digit public `storeId` (e.g. "836102").
  3. Fetch the default pricing plan (e.g. Free Tier) from the `Plan` model.
  4. Create a new `Store` row with the generated public `storeId` and set the owner relation.
  5. Update the `User` row: write `storeId = store.id` and role to `ADMIN`.
* **Success Response (201)**:
  ```json
  {
    "message": "Store created successfully after OTP verification",
    "userId": "cuid_user_id",
    "storeId": "cuid_store_id",
    "storePublicId": "836102"
  }
  ```

#### 6. Validate Device
* **Route**: `POST /api/auth/otp/validate-device`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "deviceId": "Device-Fingerprint" }`
* **Internal Logic**: Checks if the device trying to complete sign-in is listed under the Store's trusted device login list (`devicesLogin` relation). If not recognized, returns flag requiring OTP verification.

#### 7. Password Recovery: Forgot Password
* **Route**: `POST /api/auth/password/forgot-password`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX" }`
* **Internal Logic**: Checks if a user is registered under the mobile number. If yes, generates a password reset OTP and triggers SMS.

#### 8. Password Recovery: Reset Password
* **Route**: `POST /api/auth/password/reset-password`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "otp": "123456", "newPassword": "newsecurepassword" }`
* **Internal Logic**: Verifies OTP. If verified, hashes `newPassword` using Bcrypt and updates the user profile.

#### 9. Change Password
* **Route**: `POST /api/auth/password/change-password`
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Payload**: `{ "currentPassword": "oldpassword", "newPassword": "newsecurepassword" }`
* **Internal Logic**: Compares `currentPassword` against active user's hashed password. If matches, updates user password.

#### 10. Login via Credentials
* **Route**: `POST /api/auth/login`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "password": "my_password", "deviceInfo": {} }`
* **Internal Logic**: Authenticates user credentials. Returns auth token, verified role, store tenancy mapping, and device registration states.

#### 11. Auth Check Resend Availability
* **Route**: `GET /api/auth/check-resend-availability`
* **Access**: Public
* **Query Parameters**: `mobile=017XXXXXXXX&deviceToken=UUID-String`
* **Internal Logic**: Queries Redis keys `resend:${mobile}:${deviceToken}`. Returns seconds remaining before another OTP request can be submitted.

---

### Module 5.2: Auth Utilities, Store tenancies & Devices (5 Endpoints)

#### 12. Check URL Access
* **Route**: `GET /api/auth/check-url-access`
* **Query Parameters**: `mobile=017XXXXXXXX&deviceToken=UUID-String`
* **Internal Logic**: Fetches URL-tracking keys from Redis (`url_track:${mobile}:${deviceToken}`) to verify if the user's browser is authorized to access the OTP verification page directly (protects against bot scrape access).

#### 13. Auth Debug
* **Route**: `GET /api/auth/debug`
* **Access**: Admin only
* **Internal Logic**: Returns current connection health stats of Redis, SMS providers, and PostgreSQL database.

#### 14. Get User Session
* **Route**: `GET /api/auth/users/session`
* **Access**: Authenticated
* **Internal Logic**: Decodes session JWT from headers and returns verified principal's account metadata, active store, and tier restrictions.

#### 15. Stores Management (Fetch & Create Stores)
* **Route**: `GET /api/stores/management` and `POST /api/stores/management`
* **Access**: Authenticated (`ADMIN`)
* **GET**: Returns the active user's Store details based on `req.user.storeId`.
* **POST Payload**: `{ "name": "Store name", "email": "store@domain.com", "phone": "017...", "address": "Road 1, Dhaka" }`
* **Internal Logic**: Updates store profile properties, flat addresses, or creates a subsidiary branch store.

#### 16. Stores Trust Devices List
* **Route**: `GET /api/stores/devices`
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Internal Logic**: Returns a list of trusted login device signatures (`DeviceLogin` table records) for the store, showing device names, user-agents, last login IP, dates, and trust verification state.

---

### Module 5.3: Customers Management (3 Endpoints)

#### 17. Create Customer
* **Route**: `POST /api/customers/management`
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Payload**:
  ```json
  {
    "name": "Rahim Khan",
    "phone": "019XXXXXXXX",
    "email": "rahim@domain.com",
    "address": "Dhaka, Bangladesh",
    "notes": "Premium customer"
  }
  ```
* **Internal Logic**:
  1. Enforce plan restriction: Call subscription check `maxCustomers`. If store has reached customer limit allowed in active tier, reject with HTTP 403 (`CUSTOMER_LIMIT_EXCEEDED`).
  2. Check for duplicate customer number: Scan `phone` in PostgreSQL under `storeId`. If exists, reject with HTTP 409 (`DUPLICATE_CUSTOMER_NUMBER`).
  3. Generate 6-digit public `customerId`. Insert new `Customer` record under active `storeId`.
* **Success Response (201)**:
  ```json
  {
    "success": true,
    "message": "Customer created successfully",
    "data": { "customerId": "812039", "customer": { ... } }
  }
  ```

#### 18. List Customers (Paginated with Search)
* **Route**: `GET /api/customers/management`
* **Query Params**: `page=1`, `limit=10`, `search=Rahim`
* **Internal Logic**:
  1. Query active tenant's `Customer` table scoped by `storeId` where `deletedAt IS NULL`.
  2. Apply SQL pagination (`skip`, `take`).
  3. Fuzzy-search filter: If search query exists, construct search block matching `name`, `email`, `phone`, `customerId`, or `city` with case-insensitive `ILIKE`.
  4. Returns count and metadata list.

#### 19. Individual Customer (Retrieve, Update, Delete)
* **Route**: `GET | PUT | DELETE /api/customers/management/[id]`
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **GET**: Returns details of specific customer by public ID or UUID.
* **PUT Payload**: `{ "name": "Updated Name", "phone": "017...", "address": "..." }`
* **DELETE**: Performs a soft-delete (sets `deletedAt = NOW()`).

---

### Module 5.4: Services Catalog & Repair Jobs (5 Endpoints)

#### 20. Create Service Repair Job
* **Route**: `POST /api/services` (or `/api/services/management`)
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Payload**:
  ```json
  {
    "name": "Display Replacement",
    "number": "017XXXXXXXX",
    "model": "Samsung S24 Ultra",
    "problem": "Flickering screen, broken glass",
    "price": 12000,
    "partsCost": 7500,
    "advancedAmount": 2000,
    "discount": 500,
    "status": "received"
  }
  ```
* **Internal Logic**:
  1. Check plan limit restriction: Check monthly quota `maxJobsPerMonth` for the active `storeId`. If exceeded, reject with HTTP 403.
  2. Generate unique 6-digit public `serviceId`.
  3. Create `Service` record in PostgreSQL under `storeId`.
  4. Financial Transaction Side-Effect: If `advancedAmount > 0`, insert an associated `Finance` ledger record:
     - `category = "service_payment"`
     - `subcategory = "advanced_payment"`
     - `amount = advancedAmount`
     - `paymentType = "income"`
     - `affectType = ["profit"]` (affects profit margin calculations)
     - `additionalInfo = { serviceId, customerName: name, customerPhone: number }`
* **Success Response (201)**:
  ```json
  { "message": "Service created successfully", "serviceId": "918023", "id": "cuid_service" }
  ```

#### 21. Get All Services (Next.js `/api/services` variant)
* **Route**: `GET /api/services`
* **Query Params**: `status=delivered`, `page=1`, `limit=10`, `search=iPhone`
* **Internal Logic**:
  1. Base query filter scoped by tenant `storeId`.
  2. If `status=due`, construct query to find services where `status = "delivered"` and outstanding balance exists: `price > (totalPaid + discount)`.
  3. Apply pagination and search filters across `name`, `number`, `model`, `serviceId`, or `problem`.
  4. Aggregate Payment Calculations: For each returned service, fetch associated payments from `Finance` where `serviceId` matches. Compute exact sum of payments, compute `dueAmount`, and attach as dynamic fields (`totalPaid`, `dueAmount`, `isPaid`).

#### 22. Get Service List (Next.js `/api/services/management/list` variant)
* **Route**: `GET /api/services/management/list`
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Internal Logic**: Optimized lightweight list query returning minimal fields (ID, name, model, phone, price, status, createdAt) for selection components, bypassing massive finance ledger aggregations.

#### 23. Update Service Job details (PUT / Status Updates)
* **Route**: `PUT /api/services?id=cuid_service_id` (or `/api/services/management/[id]`)
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Payload**:
  ```json
  {
    "status": "delivered",
    "finalPrice": 11500,
    "discount": 500,
    "additionalPayment": 9500,
    "paymentDate": "2026-05-17T22:00:00.000Z"
  }
  ```
* **Internal Logic**:
  1. Fetch existing `Service` record.
  2. If `additionalPayment > 0`, aggregate current payments from `Finance` for this service. Ensure `currentTotalPaid + additionalPayment <= finalPrice` (payment cannot exceed estimation price).
  3. Create associated `Finance` record for the new payment (`category = "service_payment"`, `subcategory = "additional_payment"`).
  4. Update `Service` record values in PostgreSQL.

#### 24. Service Payments History
* **Route**: `GET /api/services/service-payments`
* **Query Params**: `serviceId=918023`
* **Internal Logic**: Returns all ledger entries in `Finance` associated with the specific `serviceId` to display the repair job's payment history.

---

### Module 5.5: Finance, Cash Flow, Categories & Expenses (9 Endpoints)

#### 25. Create Finance Transaction
* **Route**: `POST /api/finances/general-finances/management`
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Payload**:
  ```json
  {
    "amount": 2500,
    "category": "cash_in",
    "subcategory": "owner_investment",
    "paymentType": "income",
    "affectType": "cash",
    "date": "2026-05-17T12:00:00Z",
    "notes": "Added working cash"
  }
  ```
* **Internal Logic**:
  1. Validate fields. `paymentType` must be `income` or `expense`.
  2. Generate a 6-digit public `invoiceId`.
  3. Force correct `affectType` mapping: General Finances (Cash In/Out) must map to `affectType = ["cash"]`.
  4. Insert record into `Finance` model.
  5. Cache Invalidation: Delete Redis cache keys `finance:summary:${storeId}` and `dashboard:${storeId}`.

#### 26. List General Finances (Income / Cash In-Out)
* **Route**: `GET /api/finances/general-finances/list`
* **Query Params**: `page=1`, `limit=20`, `search=investment`, `paymentType=income`
* **Internal Logic**: Fetches paginated list from `Finance` table scoped by `storeId` and `affectType = ["cash"]`. Supports search queries matching category, subcategory, notes, or invoiceId.

#### 27. Create Expense Transaction
* **Route**: `POST /api/finances/expenses/management`
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Payload**:
  ```json
  {
    "amount": 5000,
    "category": "operating_expenses",
    "subcategory": "rent",
    "paymentType": "expense",
    "affectType": "profit",
    "date": "2026-05-17T12:00:00Z",
    "notes": "Shop monthly rent"
  }
  ```
* **Internal Logic**: Same as general finance insertion, but forces `paymentType = "expense"` and `affectType = ["profit"]` (directly impacts POS profit-margin calculations).

#### 28. List Expenses
* **Route**: `GET /api/finances/expenses/list`
* **Query Params**: `page=1`, `limit=20`, `search=rent`
* **Internal Logic**: Returns paginated ledger items filtered by `storeId` and `affectType = ["profit"]` where `paymentType = "expense"`.

#### 29. Individual Finance / Expense Transaction Detail
* **Route**: `GET /api/finances/[id]` (or `GET /api/finances/general-finances/[id]` or `GET /api/finances/expenses/[id]`)
* **Access**: Authenticated
* **Internal Logic**: Returns full record metadata of a specific finance transaction by UUID.

#### 30. Delete Finance/Expense Transaction
* **Route**: `DELETE /api/finances/[id]` (or `DELETE /api/finances/expenses/[id]`)
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Internal Logic**: Deletes specific transaction from the ledger database. Invalidates Redis dashboard cache keys.

#### 31. Create Finance Category
* **Route**: `POST /api/finances/categories`
* **Access**: Authenticated (`ADMIN`)
* **Payload**:
  ```json
  {
    "label": "Custom Salaries",
    "value": "custom_salaries",
    "type": "expense",
    "affectType": ["profit"],
    "subcategories": [
      { "label": "Full Time", "value": "full_time" }
    ]
  }
  ```
* **Internal Logic**: Inserts a new custom category under the `FinanceCategory` table in PostgreSQL. Links to `storeId` with `isCustom = true`.

#### 32. List Finance Categories
* **Route**: `GET /api/finances/categories`
* **Query Params**: `type=expense` or `affectType=cash`
* **Internal Logic**: 
  1. Queries Custom categories from `FinanceCategory` scoped by `storeId` and matching requested filters.
  2. Merges results with the hardcoded list of `DEFAULT_CATEGORIES` (Operating Expenses, Business Expenses, Cash In, Cash Out, Service Payments) before returning to the client.

#### 33. Delete Custom Finance Category
* **Route**: `DELETE /api/finances/categories/[categoryId]`
* **Access**: Authenticated (`ADMIN`)
* **Internal Logic**: Deletes store-specific custom category by CUID.

---

### Module 5.6: Plans & Multi-Tenant Subscriptions (4 Endpoints)

#### 34. List Plans Catalog
* **Route**: `GET /api/plans/management`
* **Access**: Public
* **Internal Logic**: Queries the `Plan` model catalog (FREE, BASIC, PRO, ENTERPRISE tiers) containing their pricing plans, limit configurations (user caps, monthly service job limits, custom client caps) and features list.

#### 35. Plan Status Introspection
* **Route**: `GET /api/plans/status`
* **Access**: Authenticated
* **Internal Logic**: Returns active tenant store subscription status, active plan metrics, job counters, and usage statistics.

#### 36. Manage Subscription Tiers
* **Route**: `POST /api/subscriptions/management`
* **Access**: Authenticated (`ADMIN`)
* **Payload**: `{ "tier": "PRO", "billingCycle": "monthly" }`
* **Internal Logic**: Creates or updates a Store's subscription record, setting pricing configurations, starting period, and computing next renewal billing date.

#### 37. Subscription Checks & Resource Quotas
* **Route**: `GET /api/subscriptions/check-limit`
* **Query Params**: `resource=maxJobsPerMonth`
* **Internal Logic**: Calculates current consumption metrics (e.g. total services created this month, or current total customer count) against plan tier allowances. Returns Boolean status (`allowed`, `current`, `limit`, `remaining`).

---

### Module 5.7: Dashboard KPI Analytics & Reporting (4 Endpoints)

#### 38. Dashboard Analytics Summary (Optimized & Cached)
* **Route**: `GET /api/dashboard/analytics/optimized` (or `GET /api/dashboard/analytics/summery`)
* **Access**: Authenticated (`ADMIN`, `MANAGER`, `CASHIER`)
* **Internal Logic**:
  1. Checks Redis cache key `dashboard:${storeId}`. If present, returns cached JSON payload immediately.
  2. If cache miss, aggregates the dashboard stats:
     - Parallel SQL counts: Count active users, total customers, catalog services under active `storeId`.
     - Transaction ledger aggregations: Compute total income, total expenses, net profit.
     - Sales chart history (Last 7 Days): Query daily total incomes and expenses grouped by date for the last 7 calendar days.
     - Recent Transactions list: Get the 5 latest `Finance` entries.
  3. Merges data, saves to Redis under `dashboard:${storeId}` (expiry: 60 seconds), and returns response.
* **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "storeId": "store_abc",
      "kpis": {
        "totalIncome": 125000,
        "totalExpense": 45000,
        "netProfit": 80000,
        "customerCount": 142,
        "serviceCount": 18,
        "activeUsers": 3
      },
      "last7Days": [
        { "date": "2026-05-11", "income": 4000, "expense": 1500 }
      ],
      "recentTransactions": [ ... ]
    }
  }
  ```

#### 39. Cash Balance Analytics API
* **Route**: `GET /api/finances/balance/cash-balance`
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Internal Logic**: Scans `Finance` ledger table under `storeId`. Calculates current cash in hand:
  - Cash In Hand = Sum of all `income` transactions (where `affectType` contains `cash` or `profit`) MINUS Sum of all `expense` transactions.

#### 40. Finance Analytics Stat Summaries
* **Route**: `GET /api/finances/analytics/stats`
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Internal Logic**: Returns deep financial analytics, aggregate breakdown by categories and subcategories, profit margins, and net ROI over defined date ranges.

#### 41. Report Generation and PDF/CSV Export API
* **Route**: `POST /api/reports/export`
* **Access**: Authenticated (`ADMIN`, `MANAGER`)
* **Payload**: `{ "reportType": "financial", "format": "csv", "startDate": "...", "endDate": "..." }`
* **Internal Logic**: Generates structural rows of reports based on ledger database tables and packages them into downloadable data structures.

#### 42. Reports Analytics
* **Route**: `GET /api/reports/analytics`
* **Access**: Authenticated
* **Internal Logic**: Aggregates general business metrics (monthly comparisons, growth percentages) for standard PDF reports.

---

### Module 5.8: Global Debug & Rates Limits (4 Endpoints)

#### 43. Debug Rate Limits
* **Route**: `GET /api/debug/rate-limit`
* **Access**: Public
* **Internal Logic**: Inspects in-memory / Redis rate limit counts to verify connection state and current traffic profiles.

#### 44. Centralized OTP Resend Checks
* **Route**: `POST /api/auth/check-resend-availability`
* **Access**: Public
* **Payload**: `{ "mobile": "017XXXXXXXX", "deviceToken": "UUID-String" }`
* **Internal Logic**: Internal validation mapping to support frontend components checking if resend triggers are active.

#### 45. Route Session Verification
* **Route**: `GET /api/auth/users/create-user` (GET variant)
* **Access**: Private (Admin Only)
* **Internal Logic**: Internal security check supporting administrative endpoints.

#### 46. Check Access Roles
* **Route**: `GET /api/auth/users/store-access`
* **Access**: Authenticated
* **Internal Logic**: Verifies if the authenticated session's user role possesses permissions to execute functions under specific stores.

---

## 6. Target Implementation Guide for the Developer

To implement this migration successfully inside the new NestJS backend:

### Step 1: Ensure Postgres Schema & Migrations are Up-to-Date
1. Review [schema.prisma](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/prisma/schema.prisma). Ensure all fields flat-mapped from MongoDB represent exact precision database columns (such as `Decimal` types for prices).
2. Generate migration script and apply:
   ```bash
   npx prisma migrate dev --name init_multi_tenant_pos
   ```

### Step 2: Set Up Auth Verification (JwtStrategy)
1. Do not write login logic inside NestJS for the main tenant views. Integrate `@nestjs/jwt` or `@nestjs/passport`.
2. Configure `JwtStrategy` with the **same shared JWT secret** used by the NextAuth frontend. Extract claims (`sub`, `mobile`, `role`, `storeId`) and mount them to the request context.

### Step 3: Implement StoreIsolationGuard
1. Create `StoreIsolationGuard` using NestJS `CanActivate`.
2. Implement checks checking if `req.user.storeId` matches:
   - `req.body.storeId` (if present)
   - `req.query.storeId` (if present)
   - `req.params.storeId` (if present)
3. Bind it globally in `AppModule` or apply on controller layers.

### Step 4: Re-write the OTP Redis Service
1. Wire up a `RedisService` that wraps Upstash/Redis connection clients.
2. Port the precise rate limiting, attempts tracking, and resend limit logic from `enhancedOtpService.ts` to `OtpService`.
3. Set up templates to trigger SMS API calls using the `HttpService` module.

### Step 5: Implement Cache-Aside Aggregations (Dashboard & Finance Summary)
1. In `DashboardService` and `FinanceService`, write methods that look up data from Postgres.
2. Wrap calculations inside Cache lookups using Redis:
   - Get key `dashboard:${storeId}`. If exists, return directly.
   - If not, run heavy SQL aggregation. Set value in Redis with standard TTLs.
3. Hook database writes (`POST /finances`, `PUT /services`) to automatically invalidate cache keys using `redis.del()`.

---

## 7. Dynamic Data Model Visualizer

To visualize how the entities link together inside the PostgreSQL multi-tenant model:

```mermaid
erDiagram
    STORE ||--o{ USER : contains
    STORE ||--o{ CUSTOMER : contains
    STORE ||--o{ SERVICE : contains
    STORE ||--o{ FINANCE : contains
    STORE ||--|| SUBSCRIPTION : has
    PLAN ||--o{ SUBSCRIPTION : governs
    
    USER ||--o{ CUSTOMER : "created by"
    USER ||--o{ FINANCE : "managed by"
    
    CUSTOMER ||--o{ FINANCE : associated
    SERVICE ||--o{ FINANCE : pays
```

By following this specification, the development team can construct the new APIs inside the NestJS project with perfect schema mapping, secure rate-limited OTP modules, strict tenant isolation, and high-performance cached dashboard structures!
