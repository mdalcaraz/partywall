#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/partywall"
APP_NAME="partywall"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║         PARTYWALL  DEPLOY            ║"
echo "╚══════════════════════════════════════╝"
echo ""

cd "$APP_DIR"

# ── 1. Pull latest ─────────────────────────────────────────────────────────
echo "▶ Bajando cambios..."
git pull origin main

# ── 2. Backend deps ────────────────────────────────────────────────────────
echo "▶ Instalando dependencias del servidor..."
npm install --omit=dev --prefer-offline

# ── 3. Build frontend ──────────────────────────────────────────────────────
echo "▶ Compilando el front..."
cd client
npm install --prefer-offline
npm run build
cd ..

# ── 4. Migraciones ─────────────────────────────────────────────────────────
echo "▶ Corriendo migraciones..."
npx sequelize-cli db:migrate

# ── 5. Reiniciar proceso ───────────────────────────────────────────────────
echo "▶ Reiniciando servidor..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start server.js --name "$APP_NAME" --env production
  pm2 save
fi

echo ""
echo "✓ Deploy completado."
pm2 status "$APP_NAME"
echo ""
