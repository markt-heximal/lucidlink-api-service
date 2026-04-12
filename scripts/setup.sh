#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== LucidLink API Service Setup ==="
echo ""

# --- 1. Docker ---
echo "[1/3] Starting LucidLink API container..."
cd "$ROOT_DIR/docker"

if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Install Docker first."
  exit 1
fi

docker compose up -d
echo "  -> LucidLink API running on port 3003"
echo ""

# --- 2. Health check ---
echo "[2/3] Waiting for API to be ready..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3003/api/v1/health >/dev/null 2>&1; then
    echo "  -> API is healthy"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "  -> WARNING: API did not respond within 15s. Check: docker logs lucidlink-api"
  fi
  sleep 1
done
echo ""

# --- 3. Supabase edge function ---
echo "[3/3] Supabase Edge Function"
if command -v supabase &>/dev/null; then
  echo "  Supabase CLI detected. To deploy the edge function:"
  echo ""
  echo "    cd $ROOT_DIR/supabase"
  echo "    supabase functions deploy lucidlink-browse"
  echo ""
  echo "  Then set secrets:"
  echo "    supabase secrets set LUCIDLINK_API_URL=http://<this-host>:3003"
  echo "    supabase secrets set LUCIDLINK_API_KEY=<your-bearer-token>"
else
  echo "  Supabase CLI not found. Install it to deploy the edge function:"
  echo "    npm install -g supabase"
  echo ""
  echo "  Then deploy:"
  echo "    cd $ROOT_DIR/supabase"
  echo "    supabase functions deploy lucidlink-browse"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "API Endpoints (all under /api/v1):"
echo "  GET  /health"
echo "  GET  /filespaces"
echo "  GET  /filespaces/:id"
echo "  GET  /filespaces/:id/entries/resolve?path=/"
echo "  GET  /filespaces/:id/entries/:entryId/children"
echo "  GET  /filespaces/:id/entries/:entryId"
echo "  GET  /filespaces/:id/direct-links"
echo "  GET  /filespaces/:id/permissions"
echo "  GET  /members"
echo "  GET  /groups"
echo "  GET  /providers"
echo ""
echo "Test: curl http://localhost:3003/api/v1/health"
