# 📘 Hisab247: Complete Technical Setup, Architecture & Workflow Documentation

Welcome to the central technical manual for the **Hisab247** backend engine. This document is designed to give you a full, clear, and beginner-friendly understanding of how the various components—**NestJS**, **PostgreSQL**, **Redis**, **Prisma**, and **Docker**—interact in harmony.

Whether you are working locally on your development machine or launching the app in production on a Virtual Private Server (VPS), this guide covers everything you need to know.

---

## 📌 Table of Contents
1. [Project Overview & System Architecture](#1-project-overview--system-architecture)
2. [Environment Configuration (`.env` Deep Dive)](#2-environment-configuration-env-deep-dive)
3. [Docker Compose & Physical Persistence](#3-docker-compose--physical-persistence)
4. [Prisma ORM Setup & Schema Workflows](#4-prisma-orm-setup--schema-workflows)
5. [Local Development Workflow (Step-by-Step)](#5-local-development-workflow-step-by-step)
6. [Production Deployment Concepts](#6-production-deployment-concepts)
7. [Common Issues, Errors & Fixes (Troubleshooting)](#7-common-issues-errors--fixes-troubleshooting)
8. [Visual Architecture Diagram](#8-visual-architecture-diagram)

---

## 1. Project Overview & System Architecture

Hisab247 is a production-grade, multi-tenant SaaS POS backend. Every piece of the stack is carefully chosen to fulfill a specific role, working together like a high-performance restaurant kitchen.

```
┌────────────────────────────────────────────────────────┐
│                   NestJS API Engine                    │
│  (The Master Chef: Orchestrates, routes & validates)   │
└───────────┬───────────────────────────────┬────────────┘
            │                               │
            ▼                               ▼
┌──────────────────────┐         ┌──────────────────────┐
│  PostgreSQL (Prisma) │         │    Redis Cache       │
│ (The Secure Ledger:  │         │ (The Speedy Notepad: │
│ Persistent database) │         │ Dashboard & Throttles│
└──────────────────────┘         └──────────────────────┘
```

### The Roles & Interactions

#### 1. NestJS (The Master Chef)
NestJS acts as the main brain. It listens for incoming HTTP API requests from the frontend, verifies who is asking (using JWT guards), validates that incoming data is formatted correctly (using DTO Class Validators), applies business logic, and prepares the final response.
* **How it interacts**: It talks to PostgreSQL (via Prisma) to retrieve or save permanent business data and talks to Redis to quickly cache dashboard numbers or keep track of rate limits.

#### 2. PostgreSQL & Prisma (The Secure Ledger)
PostgreSQL is the relational database—your single source of truth. Every store, user, customer, invoice, and subscription is stored here permanently. Prisma is the translator (ORM) that lets NestJS write clean TypeScript code to query the database instead of writing raw SQL.
* **How it interacts**: It sits quietly, accepting secure connections from NestJS. It executes queries, runs transactions, and ensures hard tenant isolation (keeping one business's data separate from another).

#### 3. Redis (The Speedy Notepad)
Redis is an in-memory, ultra-fast key-value store. Because PostgreSQL has to read data from a physical disk, querying complex dashboards or calculating weekly statistics over and over can slow the database down. Redis solves this by temporarily holding this calculated data in RAM.
* **How it interacts**: When a user loads the dashboard, NestJS check Redis first:
  * **Cache Hit**: If the data is in Redis, it returns it instantly (in less than 2 milliseconds!).
  * **Cache Miss**: If it's not in Redis, NestJS queries Postgres, calculates the dashboard stats, writes them to Redis for next time, and returns the response.

#### 4. Docker & Docker Compose (The Portable Container)
Docker packages the entire server infrastructure—PostgreSQL, Redis, and the NestJS code—into isolated boxes called **containers**. This guarantees that the database and cache will run **exactly the same way** on your local Windows PC, your teammate's Mac, and the production Linux server.
* **How it interacts**: Docker establishes a private virtual network. Inside this network, the containers talk to each other using their service names (like `postgres` and `redis`) instead of IP addresses.

---

## 2. Environment Configuration (`.env` Deep Dive)

The `.env` file is a secret file in the root of your project that holds keys, passwords, ports, and configuration details. This file is **git-ignored** (never uploaded to GitHub) because it contains production secrets.

### Detailed Environment Variables

Here is how each variable in your [.env.example](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/.env.example) works:

| Variable Name | Typical Value | What it does |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` or `production` | Tells NestJS whether to run in developer mode (prints raw debug logs) or production mode (runs optimized builds). |
| `PORT` | `3000` | The port number on which the NestJS server listens for HTTP requests. |
| `GLOBAL_API_PREFIX` | `api/v1` | Prefixes all your endpoints, making them clean (e.g., `http://localhost:3000/api/v1/customers`). |
| `CORS_ORIGINS` | `http://localhost:3001,https://app.hisab247.com` | An access control list of which frontends are allowed to call this API. |
| `DATABASE_URL` | *See Explanation below* | The main connection string Prisma uses to find and control your PostgreSQL database. |
| `REDIS_HOST` | `localhost` (Host) or `redis` (Docker) | Tell NestJS where the Redis server is located. |
| `REDIS_PORT` | `6379` | The port Redis is running on (default is 6379). |
| `REDIS_KEY_PREFIX`| `hisab247:` | A prefix added to all cache keys to avoid conflicts (e.g., `hisab247:dashboard:store_abc`). |
| `JWT_SECRET` | `your-secure-secret-key` | A shared secret used to verify that the incoming user tokens are signed and authentic. |
| `RATE_LIMIT_TTL` | `60` | The time window in seconds for checking rate limits. |
| `RATE_LIMIT_MAX` | `120` | Max number of requests a single user can make within the TTL window. |

---

### 💡 Crucial Concept: `localhost` vs. Docker Service Hostnames

The single biggest source of confusion for developers is setting up URLs for databases and caches. It depends entirely on **where the code is running**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 💻 HOST MACHINE (Your Windows Terminal)                                      │
│  - running `npx prisma db push` or `npm run start:dev`                      │
│  - Connection target: localhost:5432                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🐳 INSIDE DOCKER NETWORK                                                     │
│  - NestJS container talking to Postgres container                            │
│  - Connection target: postgres:5432                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Scenario A: Running your Backend locally outside of Docker (`npm run start:dev` on your machine)
If your NestJS backend is running directly in your Windows Terminal, it does not know what Docker's virtual network is. To connect to PostgreSQL and Redis, it must look at your actual computer's loopback interface:
* **`DATABASE_URL`**: `postgresql://hisab247:hisab247@localhost:5432/hisab247?schema=public`
* **`REDIS_HOST`**: `localhost`
* **Prisma Commands**: Running `npx prisma db push` from your terminal **must** use this `localhost` address.

#### Scenario B: Running your Backend inside Docker (`docker compose up`)
When your NestJS backend is running *inside* its own container managed by Docker Compose, the container is inside Docker's virtual network. It cannot find the database on `localhost`. Instead, Docker DNS translates the container names:
* **`DATABASE_URL`**: `postgresql://hisab247:hisab247@postgres:5432/hisab247?schema=public`
* **`REDIS_HOST`**: `redis`
* **Why?**: The Docker Compose service name for your database is `postgres`, and for Redis, it is `redis`.

> [!IMPORTANT]
> To develop locally, keep a `.env` file on your host machine with `localhost`. Inside the [docker-compose.yml](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/docker-compose.yml), the backend service explicitly overrides these environment values to use `postgres` and `redis` so that they work perfectly inside the container network!

---

## 3. Docker Setup Explanation

Docker Compose allows us to run PostgreSQL, Redis, and your NestJS Backend using a single configuration file: [docker-compose.yml](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/docker-compose.yml).

### The Containers Configured

1. **`postgres` container (Service: `postgres`)**
   * **Image**: `postgres:16-alpine` (Lightweight, robust PostgreSQL version 16).
   * **Container Name**: `hisab247-postgres`.
   * **Environment**: Sets up a default database `hisab247` with username `hisab247` and password `hisab247`.
   * **Healthcheck**: Periodically runs `pg_isready` to make sure the database is fully booted before anything else connects.

2. **`redis` container (Service: `redis`)**
   * **Image**: `redis:7-alpine` (Fast, in-memory cache).
   * **Container Name**: `hisab247-redis`.
   * **Command**: Starts with `--appendonly yes`, which writes data changes to disk periodically so you do not lose your cached variables if the container restarts.

3. **`backend` container (Service: `backend`)**
   * **Build**: Compiles your local codebase using the project's [Dockerfile](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/Dockerfile).
   * **Container Name**: `hisab247-backend`.
   * **Depends On**: Waits for both `postgres` and `redis` to be **healthy** before booting up.
   * **Command**: `sh -c "npx prisma migrate deploy && node dist/main.js"` (Runs pending migrations first, then boots the compiled app).

---

### Data Persistence & Physical Volume Storage

By default, everything running inside a Docker container is **ephemeral**. If you delete the container, your database tables and data are lost forever! 

To prevent this, we use **Docker Volumes**.

```
┌─────────────────────────────────┐           ┌──────────────────────────────┐
│  Docker Container (PostgreSQL)  │ ────────▶ │   Persistent Docker Volume   │
│  Writes to:                     │           │  (Saved in physical storage  │
│  /var/lib/postgresql/data       │           │   on your computer's SSD)    │
└─────────────────────────────────┘           └──────────────────────────────┘
```

In your [docker-compose.yml](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/docker-compose.yml), volumes are mapped like this:
```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - redis_data:/data
```

* **How it works**: Docker creates a folder on your physical hard drive (managed by the Docker service engine). It maps this folder inside the container's active folders.
* **Why it matters**: If you run `docker compose down`, modify your files, and then run `docker compose up` again, your PostgreSQL database tables, records, users, and Redis keys are completely safe. They are physically loaded back into the containers on start!

---

## 4. Prisma Setup

Prisma is the bridge between NestJS and PostgreSQL. It maps your database columns directly into TypeScript types, preventing bugs before they happen.

### Schema Configuration: [prisma/schema.prisma](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/prisma/schema.prisma)

Your datasource config defines where the database is located and what engine to use:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

* **Why `DATABASE_URL` is required**: Prisma needs to log in, read the structure (tables, constraints, column types), and update tables. Without this connection string, Prisma has no target to apply your schema to.

### The Development Workflow: `db push` vs. `migrate`

Prisma gives you two main ways to sync your TypeScript schema with your Postgres database:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              YOUR WORKFLOW                             │
├───────────────────────────────────┬────────────────────────────────────┤
│       npx prisma db push          │     npx prisma migrate dev         │
│  - Best for: Rapid prototyping    │  - Best for: Production & Teams    │
│  - Action: Directly syncs schema  │  - Action: Creates step-by-step    │
│  - Destructive: Might delete data │    SQL migration history files     │
└───────────────────────────────────┴────────────────────────────────────┘
```

#### 1. `npx prisma db push` (Frictionless Syncing)
* **What it does**: Compiles `schema.prisma` and updates the database tables directly. It skips creating SQL migration files.
* **When to use**: During initial development when you are rapidly changing column names or adding prototype tables and do not want to fill your project with minor SQL migration files.

#### 2. `npx prisma migrate dev` (Safe, Trackable Progression)
* **What it does**: Compares your schema changes, generates a `.sql` file inside `prisma/migrations/`, and applies it. This keeps an exact timestamped history of database changes.
* **When to use**: When developing features in a team or preparing to deploy to production.

#### 3. `npx prisma generate` (Updating the Translator Client)
* **What it does**: Re-generates the `@prisma/client` package inside `node_modules`. This creates autocomplete code and TypeScript interfaces representing your database models.
* **When it runs**: Automatically runs every time you run `prisma db push` or `prisma migrate dev`. You can run it manually if your editor complains about missing models.

---

## 5. Local Development Workflow (Step-by-Step)

To work on Hisab247 locally, follow this clear, bulletproof sequence to ensure all services connect flawlessly.

### Step 1: Clone & Configure Environments
1. Copy the example environment template into a new file named `.env`:
   ```powershell
   cp .env.example .env
   ```
2. Open `.env` and change the database connection url host from `postgres` to `localhost`:
   ```env
   # Change this:
   DATABASE_URL=postgresql://hisab247:hisab247@postgres:5432/hisab247?schema=public
   
   # To this (for running Prisma/Backend locally outside Docker):
   DATABASE_URL=postgresql://hisab247:hisab247@localhost:5432/hisab247?schema=public
   ```
3. Ensure `REDIS_HOST` is set to `localhost`:
   ```env
   REDIS_HOST=localhost
   ```

### Step 2: Spin Up the Infrastructure Containers
Start the PostgreSQL and Redis servers inside Docker. We run them in the background (detached mode) so your command line stays free:
```powershell
docker compose up -d postgres redis
```
*Verify they are healthy using:*
```powershell
docker ps
```
You will see `hisab247-postgres` and `hisab247-redis` running on ports `5432` and `6379` respectively.

### Step 3: Align your Database Schema
Apply the Prisma schema to your newly created PostgreSQL database. Since your `.env` is set to `localhost:5432`, Prisma will connect directly to the Postgres container exposed port:
```powershell
npx prisma db push
```
*Note: You can seed the database with core plans (FREE, PRO, etc.) if needed:*
```powershell
npx prisma db seed
```

### Step 4: Run the NestJS Backend in Development Mode
Now, start the backend in live-reload watch mode:
```powershell
npm run start:dev
```
Your backend starts at `http://localhost:3000/api/v1` and connects to the PostgreSQL and Redis containers exposed on your localhost loopback. Every time you make a change in the code, the server will restart automatically!

### Step 5: Test the API locally
You can now test the server by sending a request using a client like Postman, Bruno, or curl:
```powershell
curl http://localhost:3000/api/v1/plans
```
You will get a beautifully formatted response listing the default plans!

---

## 6. Production Deployment Concepts

When moving from your local computer to a cloud environment (such as a Linux Virtual Private Server or VPS), the setup changes to be highly secure and persistent.

### Production Setup Architecture

```
                 Internet
                    │
                    ▼
          ┌───────────────────┐
          │ Reverse Proxy     │ (e.g. Nginx, Traefik or Cloudflare Tunnel)
          │ - SSL Termination │ (Encrypts traffic with HTTPS)
          └─────────┬─────────┘
                    │ (Internal Network)
                    ▼
          ┌───────────────────┐
          │ NestJS Backend    │ (Docker container running node dist/main.js)
          └─────────┬─────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Cloud PostgreSQL │ │   Cloud Redis    │ (Often managed databases like AWS RDS/Elasticache
│ (Persistent Disk)│ │   (High Speed)   │  for security, auto-backups & horizontal scaling)
└──────────────────┘ └──────────────────┘
```

### Key Differences: Local vs. Production

#### 1. VPS Docker Setup
In production, your NestJS container will build from your latest production build, and all containers run in background detached mode. The backend container should never map port `3000` directly to the internet. Instead, Nginx or Traefik acts as a reverse proxy, accepting internet requests on port `80` (HTTP) and `443` (HTTPS), terminating the SSL, and forwarding the clean traffic internally to NestJS.

#### 2. Databases & Caches in Production
While running PostgreSQL and Redis inside Docker Compose is perfect for local development, in production, databases are critical. Many SaaS architectures choose to:
* Run PostgreSQL on a **managed cloud database** (like AWS RDS, Supabase, or Google Cloud SQL). This handles automated backups, multi-zone recovery, and storage scaling seamlessly.
* Use a **managed Redis instance** (like Redis Labs or AWS ElastiCache).
* **Environment URLs**: In production, your `DATABASE_URL` and `REDIS_HOST` point to secure, private private-network endpoints (e.g. `postgresql://db_user:highly_secure_pass@db-prod.internal:5432/main_db`).

---

## 7. Common Issues, Errors & Fixes (Troubleshooting)

When running NestJS, Prisma, and Docker together, you will occasionally encounter common configuration mismatches. Here is how to fix them instantly.

### Issue 1: Error `P1012` - Environment variable not found: DATABASE_URL

#### 🔴 The Symptom:
You run `npx prisma db push` or `npx prisma migrate dev` and hit the error:
```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DATABASE_URL.
```

#### 🔍 The Cause:
1. You do not have a `.env` file in the root directory (only `.env.example`).
2. You have a `.env` file, but it is located in the wrong directory (e.g., inside `src/` or `prisma/` instead of the project root).
3. The database environment variable is spelled incorrectly or not exported to your terminal.

#### 🟢 The Solution:
1. Make sure a `.env` file exists directly in the root of your project:
   ```
   nestjs-backend-project/
     ├── prisma/
     ├── src/
     ├── .env        <-- MUST BE HERE!
     ├── .env.example
     └── package.json
   ```
2. Double-check that it contains the line:
   ```env
   DATABASE_URL=postgresql://hisab247:hisab247@localhost:5432/hisab247?schema=public
   ```
3. Save the file and run the command again.

---

### Issue 2: Can't connect to Postgres / Hostname Mismatch

#### 🔴 The Symptom:
Prisma times out trying to connect, or your local NestJS server logs connection errors:
```
Can't reach database server at `postgres`:`5432`
Please make sure your database server is running at `postgres`:`5432`.
```

#### 🔍 The Cause:
You have your local `.env` set to `DATABASE_URL=...@postgres:5432/...`. When your terminal runs your backend locally outside Docker, it cannot find `postgres` in your computer's host files.

#### 🟢 The Solution:
* Check where you are running your code:
  * **Running NestJS via Terminal (`npm run start:dev`)**: Use `localhost:5432` in your `.env`.
  * **Running NestJS inside Docker (`docker compose up`)**: Use `postgres:5432` inside your Docker Compose environment settings.

---

### Issue 3: Port `5432` or `6379` is already in use

#### 🔴 The Symptom:
When running `docker compose up -d`, you get an error:
```
Error starting userland proxy: bind: address already in use: 0.0.0.0:5432
```

#### 🔍 The Cause:
You already have PostgreSQL or Redis installed directly on your Windows host operating system, and it is running as a background service. It is occupying the default port.

#### 🟢 The Solution:
1. **Option A: Stop the native host service.**
   * Open Windows Services (`services.msc`), find `postgresql-x64` or `redis`, right-click and click **Stop**.
2. **Option B: Re-map Docker ports.**
   * In your [docker-compose.yml](file:///e:/Paid-Projects/KENTASOFT/HISAB247/NEST%20JS%20BACKEND%20PROJECTS/docker-compose.yml), map the container to a different external port, like `5433`:
     ```yaml
     ports:
       - "5433:5432" # Maps host 5433 to container 5432
     ```
   * Update your `.env` `DATABASE_URL` port to `5433`.

---

### Issue 4: Prisma client is out of sync with migrations

#### 🔴 The Symptom:
You edit `schema.prisma` or pull changes from Git, and NestJS starts throwing errors:
```
Property '...' does not exist on type 'PrismaClient'
```

#### 🔍 The Cause:
The `@prisma/client` library installed in `node_modules` does not match your active database model files.

#### 🟢 The Solution:
Re-generate the TypeScript client helper files manually:
```powershell
npx prisma generate
```

---

## 8. Visual Architecture Diagram

Here is a visual roadmap of exactly how a customer creating an invoice on the **Hisab247** application flows through the system, hitting validation, database, cache, and response wrappers:

```
                  ┌──────────────────────┐
                  │  Next.js Client (UI) │
                  └──────────┬───────────┘
                             │
                             │ (1) HTTP POST /api/v1/finances (with Bearer Token)
                             ▼
               ┌───────────────────────────┐
               │    NestJS Gateway API     │
               └─────────────┬─────────────┘
                             │
            ┌────────────────┴────────────────┐
            │ Guards & Interceptors Pipeline  │
            └────────────────┬────────────────┘
                             │ (2) AuthN: Verify JWT Signature (JwtAuthGuard)
                             │ (3) Multi-Tenancy: Match JWT storeId with Request (StoreIsolationGuard)
                             │ (4) AuthZ: Verify Role permissions (RolesGuard)
                             │ (5) Validation: Check DTO types (ValidationPipe)
                             ▼
               ┌───────────────────────────┐
               │   FinanceController       │
               └─────────────┬─────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │   FinanceService (Core)   │
               └─────────────┬─────────────┘
                             ├─────────────────────────────────────────────────┐
                             │ (6) Save Transaction                            │ (8) Clear Cache
                             ▼                                                 ▼
               ┌───────────────────────────┐                     ┌───────────────────────────┐
               │  Prisma / PostgreSQL DB   │                     │      Redis Cache          │
               │  (Saves new ledger row)   │                     │  (Deletes cached summary  │
               └───────────────────────────┘                     │   and dashboard keys)     │
                             │                                   └───────────────────────────┘
                             │ (7) Row Saved Successfully
                             ▼
               ┌───────────────────────────┐
               │   ResponseInterceptor     │
               │ (Wraps result in envelope)│
               └─────────────┬─────────────┘
                             │
                             │ (9) Returns HTTP 201 Success Response
                             ▼
                  ┌──────────────────────┐
                  │  Next.js Client (UI) │
                  └──────────────────────┘
```

---

*This guide is maintained by the Hisab247 Architecture Team. For any updates to schemas or dependencies, make sure to update this document accordingly!*
