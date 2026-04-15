#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

configure_env() {
  export FILE_ENCRYPTION_KEY="${FILE_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
}

SERVICES=(
  "frontend:frontend"
  "gateway:backend/gateway"
  "user-service:backend/services/user-service"
  "credential-service:backend/services/credential-service"
  "credential-request-service:backend/services/credential-request-service"
  "notification-service:backend/services/notification-service"
  "blockchain-interface-service:backend/services/blockchain-interface-service"
  "security-service:backend/services/security-service"
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
  local dev_cmd=()

  if [[ ! -d "$abs_path" ]]; then
    echo "[$name] Missing directory: $rel_path"
    exit 1
  fi

  if [[ ! -f "$abs_path/package.json" ]]; then
    echo "[$name] Missing package.json: $rel_path/package.json"
    exit 1
  fi

  case "$rel_path" in
    "frontend")
      dev_cmd=("node" "node_modules/vite/bin/vite.js")
      ;;
    "backend/services/security-service")
      dev_cmd=("node" "node_modules/ts-node/dist/bin.js" "src/server.ts")
      ;;
    *)
      dev_cmd=(
        "node"
        "node_modules/nodemon/bin/nodemon.js"
        "--exec"
        "node node_modules/ts-node/dist/bin.js"
        "src/server.ts"
      )
      ;;
  esac

  (
    cd "$abs_path"
    echo "[$name] starting (${dev_cmd[*]})"
    "${dev_cmd[@]}" 2>&1 | sed "s/^/[$name] /"
  ) &

  PIDS+=("$!")
}

generate_shared_prisma_client() {
  local prisma_db_path="$ROOT_DIR/backend/db"
  local prisma_client_path="$ROOT_DIR/backend/db/node_modules/.prisma/client"

  if [[ ! -d "$prisma_db_path" ]]; then
    echo "[bootstrap] Missing directory: backend/db"
    exit 1
  fi

  echo "[bootstrap] Regenerating shared Prisma client once before starting services..."
  rm -rf "$prisma_client_path"
  (
    cd "$prisma_db_path"
    node node_modules/prisma/build/index.js generate 2>&1 | sed "s/^/[bootstrap] /"
  )
}

generate_shared_prisma_client
configure_env

for entry in "${SERVICES[@]}"; do
  name="${entry%%:*}"
  path="${entry#*:}"
  start_service "$name" "$path"
done

echo "All services started. Press Ctrl+C to stop."
wait
