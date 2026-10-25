#!/usr/bin/env bash
# Run on the VPS inside the app folder after extracting release.tar.gz (no build happens on the VPS).
set -euo pipefail

if [ ! -f dist/server.cjs ]; then
  echo "dist/server.cjs not found. Build on your computer with build-release.sh and upload release.tar.gz first."
  exit 1
fi
if [ ! -f .env ]; then
  echo "ERROR: .env file missing. Copy .env.example to .env and set ADMIN_PASSWORD first."
  exit 1
fi
if ! grep -q '^ADMIN_PASSWORD=.\+' .env; then
  echo "ERROR: ADMIN_PASSWORD is empty in .env"
  exit 1
fi

echo ">>> 1. Installing production dependencies..."
if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

echo ">>> 2. Configuring Nginx..."
if [ -f nginx.conf ] && [ -d /etc/nginx/sites-available ]; then
  cp /etc/nginx/sites-available/default "/etc/nginx/sites-available/default.bak.$(date +%s)" 2>/dev/null || true
  cp nginx.conf /etc/nginx/sites-available/default
  nginx -t && systemctl reload nginx
fi

echo ">>> 3. Starting / reloading PM2 process..."
# (the app loads .env itself via dotenv)
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "=========================================="
echo " DONE. Check status with: pm2 logs sms-gateway"
echo "=========================================="
