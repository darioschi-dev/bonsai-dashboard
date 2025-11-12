#!/bin/bash
# ============================================================
#  Bonsai Dashboard — Deploy rapido su Raspberry Pi 3 B (PM2)
# ============================================================

set -euo pipefail

PI_HOST="pi-node1"
PI_USER="pi"
PI_PATH="/home/pi/bonsai-dashboard"
ARCHIVE_NAME="bonsai-dashboard-deploy.tar.gz"

echo " Build server"
npm run build

echo "📦 Creazione archivio (build già pronta)..."
cd "$(dirname "$0")"

tar --exclude=node_modules --exclude=uploads/tmp \
    -czf "/tmp/${ARCHIVE_NAME}" \
    dist dist-frontend package.json package-lock.json .env

echo "🚀 Copia su ${PI_USER}@${PI_HOST}:${PI_PATH}"
ssh ${PI_USER}@${PI_HOST} "mkdir -p ${PI_PATH}"
scp /tmp/${ARCHIVE_NAME} ${PI_USER}@${PI_HOST}:${PI_PATH}/

echo "🧩 Deploy remoto..."
ssh ${PI_USER}@${PI_HOST} bash -s <<'EOF'
set -euo pipefail
cd ~/bonsai-dashboard

echo "⛔ Arresto processo esistente..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete bonsai-dashboard >/dev/null 2>&1 || true
else
  pkill -f "node dist/server.js" >/dev/null 2>&1 || true
fi

echo "📂 Pulizia build precedente..."
rm -rf dist dist-frontend
tar -xzf bonsai-dashboard-deploy.tar.gz
rm bonsai-dashboard-deploy.tar.gz

# ✅ Installa solo se mancano le dipendenze
if [ ! -d "node_modules" ]; then
  echo "📦 Installazione dipendenze runtime (prima volta)..."
  npm install --omit=dev --no-audit --no-fund
else
  echo "✅ Dipendenze già presenti, salto installazione."
fi

echo "🚀 Avvio con PM2 (se disponibile)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 start dist/server.js --name bonsai-dashboard --env production
  pm2 save
else
  nohup npm start > bonsai.log 2>&1 &
fi

echo "✅ Deploy completato su http://192.168.1.240:8081"
EOF

echo "🧹 Pulizia locale..."
rm -f "/tmp/${ARCHIVE_NAME}"

echo "🎉 Done!"
