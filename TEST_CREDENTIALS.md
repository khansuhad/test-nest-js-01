# Hisab247 — Test Credentials

Everything the seed produces, in one place. Re-run `npm run prisma:seed` any time
to reset the dataset (it's idempotent on the IDs below).

> **Password for every account:** `Test@1234`

---

## 1. Personas

| Persona key       | Mobile        | Role     | Store          | Plan | Email                  |
| ----------------- | ------------- | -------- | -------------- | ---- | ---------------------- |
| `admin`           | `01700000001` | ADMIN    | Test POS Store | PRO  | admin@test-pos.com     |
| `manager`         | `01700000002` | MANAGER  | Test POS Store | PRO  | manager@test-pos.com   |
| `cashier`         | `01700000003` | CASHIER  | Test POS Store | PRO  | cashier@test-pos.com   |
| `store2-admin`    | `01700000010` | ADMIN    | Side Shop      | FREE | admin@side-shop.com    |

Mint a JWT for any of them:

```powershell
npm run token                 # default = admin
npm run token manager
npm run token cashier
npm run token store2-admin
npm run token admin 7d        # custom expiry
```

The script prints the raw token plus a copy-paste-ready
`Authorization: Bearer ...` header.

---

## 2. Stores

| Store           | publicId | id (lookup via /api/v1/stores/management) | Plan | Currency |
| --------------- | -------- | ----------------------------------------- | ---- | -------- |
| Test POS Store  | `100001` | (cuid, varies — fetch from `GET /stores/management`) | PRO  | BDT |
| Side Shop       | `100002` | (cuid)                                    | FREE | BDT |

Multi-tenant isolation rule: a token issued for one store **cannot** touch the
other store's data. Use the two stores together to test the StoreIsolationGuard.

---

## 3. Sample data — Store A (Test POS Store)

### Customers

| publicId | Name           | Phone         | City       | Notes            |
| -------- | -------------- | ------------- | ---------- | ---------------- |
| `200001` | Rahim Khan     | `01911111101` | Dhaka      | Premium customer |
| `200002` | Sumi Akter     | `01911111102` | Dhaka      |                  |
| `200003` | Fahim Hossain  | `01911111103` | Chittagong | Walk-in          |
| `200004` | Nila Sultana   | `01911111104` | Sylhet     |                  |
| `200005` | Tareq Aziz     | `01911111105` | Dhaka      | Bulk client      |

### Services (repair jobs)

| publicId | Name                  | Model              | Status       | Price | Advanced |
| -------- | --------------------- | ------------------ | ------------ | ----- | -------- |
| `300001` | Display Replacement   | iPhone 15 Pro      | IN_PROGRESS  | 12000 | 2000     |
| `300002` | Battery Replacement   | Samsung S24 Ultra  | DELIVERED    | 6500  | 6500     |
| `300003` | Charging Port Repair  | Pixel 8            | PENDING      | 4500  | 0        |

### Finance entries

| publicId | Type    | Amount | Category           | Subcategory       | affectType  |
| -------- | ------- | ------ | ------------------ | ----------------- | ----------- |
| `400001` | INCOME  | 2000   | service_payment    | advanced_payment  | [profit]    |
| `400002` | INCOME  | 6500   | service_payment    | final_payment     | [profit]    |
| `400003` | EXPENSE | 5000   | operating_expenses | rent              | [profit]    |
| `400004` | INCOME  | 20000  | cash_in            | owner_investment  | [cash]      |
| `400005` | EXPENSE | 3500   | cash_out           | owner_withdrawal  | [cash]      |

**Derived totals:**
- `totalIncome` = 28500
- `totalExpense` = 8500
- `netProfit` = 20000
- Cash-in-hand (income − expense) = 20000

### Custom finance category

| value             | label           | type    | affectType | subcategories                                |
| ----------------- | --------------- | ------- | ---------- | -------------------------------------------- |
| `custom_salaries` | Custom Salaries | EXPENSE | [profit]   | full_time, part_time                         |

### Device logins

| deviceId           | Trusted | User    |
| ------------------ | ------- | ------- |
| `device-a-trusted` | ✓       | admin   |
| `device-a-mobile`  | —       | cashier |

---

## 4. Sample data — Store B (Side Shop)

### Customers

| publicId | Name                 | Phone         | City       |
| -------- | -------------------- | ------------- | ---------- |
| `210001` | Chittagong Customer 1| `01922222201` | Chittagong |
| `210002` | Chittagong Customer 2| `01922222202` | Chittagong |

### Services

| publicId | Name                | Model           | Status   | Price | Advanced |
| -------- | ------------------- | --------------- | -------- | ----- | -------- |
| `310001` | Speaker Replacement | Redmi Note 13   | RECEIVED | 2200  | 500      |

### Finance entries

| publicId | Type    | Amount | Category           | Subcategory       | affectType |
| -------- | ------- | ------ | ------------------ | ----------------- | ---------- |
| `410001` | INCOME  | 500    | service_payment    | advanced_payment  | [profit]   |
| `410002` | EXPENSE | 1500   | operating_expenses | utilities         | [profit]   |

### Device login

| deviceId          | Trusted | User         |
| ----------------- | ------- | ------------ |
| `device-b-laptop` | ✓       | store2-admin |

---

## 5. RBAC matrix — what each persona can hit

| Endpoint                                  | admin | manager | cashier | store2-admin |
| ----------------------------------------- | :---: | :-----: | :-----: | :----------: |
| `GET  /auth/users/session`                |  ✓   |   ✓    |   ✓    |     ✓       |
| `GET  /stores/management`                 |  ✓   |   ✓    |   ✓    |     ✓       |
| `POST /stores/management`                 |  ✓   |   ✗    |   ✗    |     ✓       |
| `GET  /customers/management`              |  ✓   |   ✓    |   ✓    |     ✓       |
| `POST /customers/management`              |  ✓   |   ✓    |   ✓    |     ✓       |
| `DELETE /customers/management/:id`        |  ✓   |   ✓    |   ✗    |     ✓       |
| `POST /services/management`               |  ✓   |   ✓    |   ✓    |     ✓       |
| `PUT  /services/management/:id`           |  ✓   |   ✓    |   ✗    |     ✓       |
| `POST /finances/general-finances/management` |  ✓   |   ✓    |   ✓    |     ✓       |
| `POST /finances/expenses/management`      |  ✓   |   ✓    |   ✗    |     ✓       |
| `DELETE /finances/:id`                    |  ✓   |   ✓    |   ✗    |     ✓       |
| `POST /finances/categories`               |  ✓   |   ✗    |   ✗    |     ✓       |
| `GET  /finances/balance/cash-balance`     |  ✓   |   ✓    |   ✗    |     ✓       |
| `POST /subscriptions/management`          |  ✓   |   ✗    |   ✗    |     ✓       |

`✓` = allowed, `✗` = expect HTTP 403 from `RolesGuard`.

---

## 6. Quick curl walkthrough

Open two terminals.

### Terminal 1 — boot

```powershell
docker compose up -d postgres redis
npm install
npx prisma db push
npm run prisma:seed
npm run start:dev
```

### Terminal 2 — test

```powershell
$BASE = "http://localhost:3000/api/v1"
$ADMIN = (npm run token --silent -- admin) -match "Bearer (\S+)" | Out-Null; $ADMIN = $Matches[1]
# (or simply: npm run token, then copy the raw token below)
```

Or with Bash / Git Bash:

```bash
BASE="http://localhost:3000/api/v1"
TOKEN_ADMIN="<paste token from `npm run token admin`>"
TOKEN_CASHIER="<paste token from `npm run token cashier`>"
TOKEN_STORE2="<paste token from `npm run token store2-admin`>"
```

### 1. Auth — who am I?

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" $BASE/auth/users/session
```

### 2. Dashboard KPIs

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" $BASE/dashboard/analytics/optimized
```

Expected `kpis.totalIncome=28500`, `totalExpense=8500`, `netProfit=20000`.

### 3. Finance summary (cached after first hit)

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" $BASE/finances/analytics/stats
```

### 4. Cash balance

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" $BASE/finances/balance/cash-balance
```

Expected `cashInHand=20000`.

### 5. Create a customer (CASHIER allowed)

```bash
curl -X POST $BASE/customers/management \
  -H "Authorization: Bearer $TOKEN_CASHIER" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Cashier Customer","phone":"01988887777","city":"Dhaka"}'
```

### 6. RBAC fail — cashier deleting customer

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN_CASHIER" \
  $BASE/customers/management/200001
```

Expected `403 Forbidden` — cashier role can't delete.

### 7. Tenant isolation — Store 2 admin reaching Store 1 data

```bash
# This Store-2 token only sees Store-2 customers; Store-1 publicId 200001 is invisible.
curl -H "Authorization: Bearer $TOKEN_STORE2" \
  "$BASE/customers/management/200001"
```

Expected `404 Not Found` (the customer exists in Store A but Store B can't see it).

### 8. Plan limit check (cashier)

```bash
curl -H "Authorization: Bearer $TOKEN_CASHIER" \
  "$BASE/subscriptions/check-limit?resource=maxJobsPerMonth"
```

### 9. List finance categories (defaults + custom merged)

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" $BASE/finances/categories
```

You should see the 5 defaults plus `custom_salaries`.

### 10. Service payment history

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/services/service-payments?serviceId=300001"
```

Returns the `400001` advance row.

---

## 7. Resetting the test bed

Anytime the data gets messy:

```powershell
npx prisma db push --accept-data-loss --force-reset
npm run prisma:seed
```

That wipes the database, re-applies the schema, and re-seeds every record listed above with the same publicIds.
