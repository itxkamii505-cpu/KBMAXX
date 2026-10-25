#!/usr/bin/env bash
# Run this on YOUR computer (not on the VPS). It builds the app and creates release.tar.gz
set -euo pipefail
echo ">>> Installing dependencies..."
npm install
echo ">>> Building..."
npm run build
echo ">>> Packing release.tar.gz ..."
FILES="dist package.json ecosystem.config.cjs nginx.conf vps-deploy.sh"
[ -f package-lock.json ] && FILES="$FILES package-lock.json"
tar -czf release.tar.gz $FILES
echo "Done. Upload release.tar.gz to the VPS, extract it into the app folder, then run: bash vps-deploy.sh"
