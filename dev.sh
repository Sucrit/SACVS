#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

SERVICES=(
  "frontend:frontend"
  "gateway:backend/gateway"
  "user-service:backend/services/user-service"
  "credential-service:backend/services/credential-service"
  "credential-request-service:backend/services/credential-request-service"
  "notification-service:backend/services/notification-service"
)

PIDS=()

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "Stopping all dev services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
}

trap cleanup INT TERM EXIT

start_service() {
  local name="$1"
  local rel_path="$2"
  local abs_path="$ROOT_DIR/$rel_path"

  if [[ ! -d "$abs_path" ]]; then
    echo "[$name] Missing directory: $rel_path"
    exit 1
  fi

  if [[ ! -f "$abs_path/package.json" ]]; then
    echo "[$name] Missing package.json: $rel_path/package.json"
    exit 1
  fi

  (
    cd "$abs_path"
    echo "[$name] starting (npm run --ignore-scripts dev)"
    npm run --ignore-scripts dev 2>&1 | sed "s/^/[$name] /"
  ) &

  PIDS+=("$!")
}

generate_shared_prisma_client() {
  local prisma_service_path="$ROOT_DIR/backend/services/user-service"
  local prisma_client_path="$ROOT_DIR/backend/db/node_modules/.prisma/client"

  if [[ ! -d "$prisma_service_path" ]]; then
    echo "[bootstrap] Missing directory: backend/services/user-service"
    exit 1
  fi

  echo "[bootstrap] Regenerating shared Prisma client once before starting services..."
  rm -rf "$prisma_client_path"
  (
    cd "$prisma_service_path"
    npm run db:generate 2>&1 | sed "s/^/[bootstrap] /"
  )
}

generate_shared_prisma_client

for entry in "${SERVICES[@]}"; do
  name="${entry%%:*}"
  path="${entry#*:}"
  start_service "$name" "$path"
done

echo "All services started. Press Ctrl+C to stop."
wait
