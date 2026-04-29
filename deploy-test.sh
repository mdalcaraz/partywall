#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/partywall-test"
APP_NAME="partywall-test"
BRANCH="${1:-main}"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      PARTYWALL  DEPLOY  TEST         ║"
echo "╚══════════════════════════════════════╝"
echo "  Branch: $BRANCH"
echo ""

cd "$APP_DIR"

# ── 1. Pull branch ─────────────────────────────────────────────────────────
echo "▶ Bajando branch: $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

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
echo "▶ Reiniciando servidor de test..."
pm2 reload "$APP_NAME" --update-env

echo ""
echo "✓ Deploy test completado en https://partywalltest.topdjgroup.com"
pm2 status "$APP_NAME"
echo ""
