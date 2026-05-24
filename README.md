# Hisab247 — Backend

Production-grade SaaS POS backend built with NestJS, PostgreSQL (Prisma), and Redis.

## Deploy to VPS (Hostinger + GitHub)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step commands (Docker, Nginx, SSL, updates).

## Quick start (local)

```bash
cp .env.example .env
docker compose up --build
```

The API is then available at `http://localhost:3000/api/v1`.
Swagger UI (non-prod): `http://localhost:3000/api/v1/docs`.

## First-time DB setup

The backend container runs `prisma migrate deploy` on startup. For local dev outside Docker:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed     # seed plan catalog
npm run start:dev
```

## Project layout

See [DOCUMENTATION.md](./DOCUMENTATION.md) for the full architecture, security model, API reference, data flows, and scaling notes.

## Auth

This backend **only verifies** JWTs issued by the NextAuth frontend. There is no login UI, no user provisioning endpoint, no password handling. Frontend must send:

```
Authorization: Bearer <jwt>
```

The token payload must include `userId` (or `sub`), `role`, `storeId`, and optionally `subscriptionPlan`. See [DOCUMENTATION.md](./DOCUMENTATION.md#2-authentication-flow).
