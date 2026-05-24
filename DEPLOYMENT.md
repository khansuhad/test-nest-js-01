# Hisab247 Backend — VPS Deployment (Hostinger + GitHub)

This guide deploys the NestJS API on a **Hostinger VPS** using **Docker Compose**, with **Nginx** for HTTPS and code pulled from **GitHub**.

**Recommended stack on the VPS:**

| Component | How it runs |
|-----------|-------------|
| PostgreSQL 16 | Docker (`postgres` service) |
| Redis 7 | Docker (`redis` service) |
| NestJS API | Docker (`backend` service) |
| HTTPS / domain | Nginx + Let's Encrypt (Certbot) on the host |

The API listens on `127.0.0.1:3000` only; Nginx exposes `https://api.yourdomain.com`.

---

## What you need before starting

1. **Hostinger VPS** with Ubuntu 22.04 or 24.04 (root or sudo user).
2. **Domain** (e.g. `api.hisab247.com`) with an **A record** pointing to the VPS public IP.
3. **GitHub repository** containing this project (push your code first).
4. **JWT secret** shared with your NextAuth frontend (`JWT_SECRET` must match on both sides).

---

## Part 1 — Push project to GitHub (on your PC)

```bash
cd "path/to/NEST JS BACKEND PROJECTS"
git init
git add .
git commit -m "Initial backend for VPS deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

**Do not commit real secrets.** These files stay local on the server only:

- `.env`
- `.env.docker`
- `.env.production`

Templates in the repo: `.env.docker.example`, `.env.production.example`.

---

## Part 2 — First-time VPS setup (SSH into Hostinger)

Connect:

```bash
ssh root@YOUR_VPS_IP
```

Replace `root` with your Hostinger sudo user if different.

### 2.1 Update system

```bash
apt update && apt upgrade -y
```

### 2.2 Install Docker

```bash
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
```

Verify:

```bash
docker --version
docker compose version
```

### 2.3 Install Nginx and Certbot (SSL)

```bash
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx
```

### 2.4 Clone the repository

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_USER/YOUR_REPO.git hisab247-backend
cd hisab247-backend
```

For a private repo, use a [GitHub deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) or personal access token.

---

## Part 3 — Configure environment on the VPS

### 3.1 Create `.env.docker`

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Set at minimum:

| Variable | Example / notes |
|----------|-----------------|
| `POSTGRES_PASSWORD` | Strong random password |
| `REDIS_PASSWORD` | Strong random password |
| `JWT_SECRET` | Same as NextAuth — `openssl rand -base64 48` |
| `CORS_ORIGINS` | Your real frontend URLs, comma-separated |
| `RUN_DB_SEED` | `false` in production |

Generate secrets:

```bash
openssl rand -base64 48    # JWT_SECRET
openssl rand -base64 32    # POSTGRES_PASSWORD / REDIS_PASSWORD
```

### 3.2 Edit Nginx config for your domain

```bash
nano deploy/nginx/api.hisab247.com.conf
```

Change every `api.hisab247.com` to your real API hostname (e.g. `api.yourdomain.com`).

Install the site:

```bash
cp deploy/nginx/api.hisab247.com.conf /etc/nginx/sites-available/api.hisab247.com
ln -sf /etc/nginx/sites-available/api.hisab247.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## Part 4 — Start the application (Docker)

From the project root on the VPS:

```bash
cd /var/www/hisab247-backend

docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

Check containers:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
```

Health check (on the VPS):

```bash
curl http://127.0.0.1:3000/api/v1/health
```

Expected: `{"ok":true,"service":"hisab247-backend"}` (wrapped by your API interceptor if enabled).

---

## Part 5 — Enable HTTPS (Let's Encrypt)

DNS must already point to this server.

```bash
certbot --nginx -d api.hisab247.com
```

Follow prompts (email, agree, redirect HTTP → HTTPS).

Test renewal:

```bash
certbot renew --dry-run
```

---

## Part 6 — Firewall (recommended)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Postgres (`5432`) and Redis (`6379`) are bound to `127.0.0.1` in `docker-compose.yml`, so they are not exposed publicly.

---

## Part 7 — Deploy updates from GitHub

After you push new code to GitHub, on the VPS:

```bash
cd /var/www/hisab247-backend
chmod +x scripts/vps-deploy.sh
./scripts/vps-deploy.sh
```

Or manually:

```bash
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.docker up -d --build
```

---

## Optional — one-time database seed (test data)

Production **does not** auto-seed (`RUN_DB_SEED=false`).

**Option A — HTTP (recommended):** set `SEED_SECRET` in `.env.docker`, restart backend, then:

```bash
curl -X POST https://api.hisab247.com/api/v1/admin/seed \
  -H "X-Seed-Secret: YOUR_SEED_SECRET"
```

**Option B — CLI (dev only):** set `RUN_DB_SEED=true` once in `.env.docker`, redeploy, then set back to `false`.

Remove or rotate `SEED_SECRET` after real customers exist.

---

## Verify end-to-end

1. `curl https://api.hisab247.com/api/v1/health`
2. Open Swagger only if `ENABLE_SWAGGER=true` (not recommended in production).
3. Call a protected route from your frontend with a valid JWT.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| `502 Bad Gateway` | `docker compose ps` — is `backend` running? `curl http://127.0.0.1:3000/api/v1/health` |
| DB connection error | `POSTGRES_PASSWORD` in `.env.docker` matches compose; check `docker compose logs postgres` |
| Redis auth error | `REDIS_PASSWORD` set in `.env.docker` and passed to backend |
| JWT invalid | `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` match NextAuth |
| CORS blocked | `CORS_ORIGINS` includes exact frontend origin (scheme + host, no trailing slash) |
| Build fails | `docker compose ... build --no-cache` and read build log |
| Migrations failed | `docker compose exec backend npx prisma migrate deploy` |

View logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f postgres
```

---

## Project layout (deployment-related)

```
├── docker-compose.yml          # Base stack (dev + prod)
├── docker-compose.prod.yml     # Production overrides (secrets, no public port)
├── Dockerfile                  # Multi-stage NestJS image
├── .env.docker.example         # Template for VPS env
├── deploy/nginx/               # Nginx site config
├── scripts/vps-deploy.sh       # Pull + rebuild helper
└── DEPLOYMENT.md               # This file
```

---

## Security checklist

- [ ] `.env.docker` exists only on the server, never in git
- [ ] Strong `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`
- [ ] `RUN_DB_SEED=false` in production
- [ ] `CORS_ORIGINS` lists real domains only (no `*`)
- [ ] `ENABLE_SWAGGER=false`
- [ ] UFW allows only SSH + Nginx
- [ ] Rotate or remove `SEED_SECRET` after go-live

---

## Hostinger notes

- Use **VPS** (KVM), not shared hosting — Node/Docker is not supported on basic web hosting.
- In hPanel, open the VPS console or use SSH with the IP and password/key Hostinger provides.
- If you use Hostinger’s firewall panel, allow ports **22**, **80**, and **443**.

For questions about this API, see [DOCUMENTATION.md](./DOCUMENTATION.md) and [README.md](./README.md).
