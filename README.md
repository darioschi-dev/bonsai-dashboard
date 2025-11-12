# Bonsai MQTT Dashboard — Standalone Version (No Docker)

Sistema completo per monitorare e gestire il bonsai via ESP32:

- Dashboard web (Vue 3 + Vite)
- Backend Node.js (OTA + API + MQTT)
- Broker MQTT esterno (Mosquitto)

## Requisiti

- Node.js ≥ 18
- NPM ≥ 9
- Mosquitto MQTT
- ESP32 configurato per pubblicare su `bonsai/<device_id>/data`

## Installazione

```bash
git clone https://github.com/<your-user>/bonsai-dashboard.git
cd bonsai-dashboard
npm install
```

## Configurazione Backend

Crea `.env` nella root:

```
PORT=8081
HOST=0.0.0.0
BASE_URL=http://192.168.1.240:8081
MQTT_URL=mqtt://192.168.1.240:1883
UPDATE_HOST=bonsai-iot-update.darioschiavano.it
LOG_LEVEL=info
```

## Configurazione Frontend

Dentro `src/frontend/` crea:

### `.env.development`
```
VITE_MQTT_URL=ws://192.168.1.240:9001
VITE_MQTT_USERNAME=bonsai
VITE_MQTT_PASSWORD=JpZAy01eQuxshT910FanQM3AzvsG3g1q
VITE_CLIENT_ID=bonsai-dashboard-dev
```

### `.env.production`
```
VITE_MQTT_URL=ws://192.168.1.240:9001
VITE_MQTT_USERNAME=bonsai
VITE_MQTT_PASSWORD=JpZAy01eQuxshT910FanQM3AzvsG3g1q
VITE_CLIENT_ID=bonsai-dashboard
```

## Build Frontend

```bash
npm run build
```

## Avvio Produzione

```bash
pm2 start dist/server.js --name bonsai-dashboard
pm2 save
```

## URL Dashboard

`http://pi-node1.local:8081`

