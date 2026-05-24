# =========================
# Stage 1: Build
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL is required by Prisma's query engine on alpine
RUN apk add --no-cache openssl

# Copy manifest + lockfile first for cache friendliness.
# If package-lock.json is missing, fall back to `npm install`
# so the build doesn't crash in CI.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "WARN: package-lock.json missing — falling back to npm install"; \
      npm install; \
    fi

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# =========================
# Stage 2: Runtime
# =========================
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl tini \
 && addgroup -S nodejs \
 && adduser -S nestjs -G nodejs

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi \
 && npm install prisma@5.18.0 ts-node@10.9.2 typescript@5.5.4 --no-save

# Generated client from builder — guarantees UserRole and other enums exist at runtime.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=builder /app/dist ./dist

USER nestjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
