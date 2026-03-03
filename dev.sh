#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH."
  exit 1
fi

configure_ai_env() {
  export AI_ENABLED="${AI_ENABLED:-true}"
  export AI_ENFORCE_GATE="${AI_ENFORCE_GATE:-true}"
  export AI_PROVIDER="${AI_PROVIDER:-ml}"
  export AI_SERVICE_URL="${AI_SERVICE_URL:-http://localhost:5500}"
  export AI_MODEL_SERVICE_URL="${AI_MODEL_SERVICE_URL:-http://localhost:5001}"
  export AI_SCORE_CLEAR_THRESHOLD="${AI_SCORE_CLEAR_THRESHOLD:-0.35}"
  export AI_SCORE_BLOCK_THRESHOLD="${AI_SCORE_BLOCK_THRESHOLD:-0.70}"
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
  "ai-interface-service:backend/services/ai-interface-service"
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

start_ai_model_service() {
  local name="ai-model-service"
  local rel_path="backend/ai-model-service"
  local abs_path="$ROOT_DIR/$rel_path"
  local python_exec=()

  if [[ ! -d "$abs_path" ]]; then
    echo "[$name] Missing directory: $rel_path"
    exit 1
  fi

  if [[ ! -f "$abs_path/app.py" ]]; then
    echo "[$name] Missing app.py: $rel_path/app.py"
    exit 1
  fi

  if [[ -x "$abs_path/.venv/Scripts/python.exe" ]]; then
    python_exec=("$abs_path/.venv/Scripts/python.exe")
  elif command -v python >/dev/null 2>&1; then
    python_exec=("python")
  elif command -v py >/dev/null 2>&1; then
    python_exec=("py" "-3")
  else
    echo "[$name] Python is not installed or not in PATH."
    echo "[$name] Install Python dependencies with: pip install -r backend/ai-model-service/requirements.txt"
    exit 1
  fi

  (
    cd "$abs_path"
    echo "[$name] starting (${python_exec[*]} -m uvicorn app:app --host 0.0.0.0 --port 5001 --reload)"
    "${python_exec[@]}" -m uvicorn app:app --host 0.0.0.0 --port 5001 --reload 2>&1 | sed "s/^/[$name] /"
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
configure_ai_env
start_ai_model_service

for entry in "${SERVICES[@]}"; do
  name="${entry%%:*}"
  path="${entry#*:}"
  start_service "$name" "$path"
done

echo "All services started. Press Ctrl+C to stop."
wait
