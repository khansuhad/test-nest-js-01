#!/usr/bin/env bash
# Pull latest code and restart production stack on the VPS.
# Run from the project root on the server:
#   chmod +x scripts/vps-deploy.sh
#   ./scripts/vps-deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.docker.example and fill in secrets."
  exit 1
fi

echo "==> Pulling latest from git..."
git pull --ff-only

echo "==> Building and starting containers..."
docker compose $COMPOSE_FILES --env-file "$ENV_FILE" up -d --build

echo "==> Waiting for health check..."
sleep 5
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2- || echo 3000)"
PORT="${PORT:-3000}"
curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" && echo ""

echo "==> Done. API should be reachable via Nginx (https://your-domain)."
