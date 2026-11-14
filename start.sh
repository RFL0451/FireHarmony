#!/usr/bin/env bash
# FireHarmony one-command start for Linux / macOS / Git Bash.
set -e
cd "$(dirname "$0")"

echo "============================================"
echo "  FireHarmony - local start"
echo "============================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed. Get it from https://nodejs.org (LTS)."
  exit 1
fi
echo "[OK] $(node --version)"

if [ ! -d server/node_modules ]; then
  echo "[...] Installing dependencies..."
  (cd server && npm install --no-fund --no-audit)
  echo "[OK] Dependencies installed"
fi

if [ ! -f server/.env ]; then
  echo
  echo "Live satellite data needs a free NASA FIRMS key:"
  echo "  https://firms.modaps.eosdis.nasa.gov/api/map_key/"
  read -r -p "Paste your FIRMS key (empty = demo mode): " KEY
  printf 'FIRMS_MAP_KEY=%s\nPORT=3000\n' "$KEY" > server/.env
fi

( sleep 2; (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) \
  || (command -v open >/dev/null && open http://localhost:3000) || true ) &

echo
echo "App: http://localhost:3000  (Ctrl+C to stop)"
exec node server/index.js
