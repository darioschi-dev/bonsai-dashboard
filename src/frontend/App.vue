<template>
  <div class="app">
    <!-- HEADER -->
    <DashboardHeader
        :online="Object.keys(devices).length > 0"
        :active-id="activeDevice"
        :device-ids="Object.keys(devices)"
        :devices="devices"
        @toggle-pump="(s) => togglePump(activeDevice, s)"
        @select-device="setActiveDevice"
    />

    <!-- EMPTY STATE -->
    <div v-if="Object.keys(devices).length === 0" class="empty-state">
      <p>Nessun dispositivo connesso.</p>
      <p class="hint">
        In attesa di dati MQTT dal topic
        <code>bonsai/&lt;device_id&gt;/status/#</code>…
      </p>
    </div>

    <!-- DASHBOARD PRINCIPALE -->
    <div class="device-block">
      <div class="status-grid">
        <DashboardCard icon="tint" label="Umidità" :value="fmt(device.humidity)" />
        <DashboardCard icon="battery-half" label="Batteria" :value="fmt(device.battery)" />
        <DashboardCard icon="temperature-low" label="Temperatura" :value="fmt(device.temperature)" />
        <DashboardCard icon="wifi" label="WiFi RSSI" :value="fmt(device.rssi)" />
        <DashboardCard icon="clock" label="Ultimo messaggio" :value="device.lastSeen ?? '--'" />
        <DashboardCard icon="microchip" label="Firmware" :value="device.firmware ?? '--'" />
      </div>

      <h2 v-if="activeDevice" :style="{ color: getColor(activeDevice) }">
        <i class="fas fa-microchip"></i> {{ activeDevice }}
      </h2>
      <h2 v-else><i class="fas fa-microchip"></i> Nessun dispositivo selezionato</h2>

      <HumidityChart :humidity="device.humidity ?? 0" />
      <HistorySection v-if="activeDevice" :device-id="activeDevice" />

      <DeviceConfig
          v-if="activeDevice"
          :device-id="activeDevice"
          @save="(cfg) => saveConfig(activeDevice!, cfg)"
      />

      <FirmwarePanel :device-id="activeDevice" />
      <FirmwareActions v-if="activeDevice" :device-id="activeDevice" />

      <div v-if="firmwareUpdateAvailable" class="ota-banner">
        <i class="fas fa-exclamation-triangle"></i>
        Nuovo firmware disponibile:
        <strong>{{ serverConfig.latest_firmware }}</strong>
      </div>

      <FirmwareUploader />
    </div>

    <ModalConfirm
        v-if="showConfirm"
        @confirm="confirmSave"
        @close="showConfirm = false"
    />

    <ModalAuth
        v-if="showAuth"
        @auth="authenticate"
        @close="showAuth = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DashboardHeader from './components/DashboardHeader.vue'
import DashboardCard from './components/DashboardCard.vue'
import HumidityChart from './components/HumidityChart.vue'
import DeviceConfig from './components/DeviceConfig.vue'
import FirmwareUploader from './components/FirmwareUploader.vue'
import ModalConfirm from './components/ModalConfirm.vue'
import ModalAuth from './components/ModalAuth.vue'
import HistorySection from './components/HistorySection.vue'
import { mqttConnect } from './utils/mqttClient'
import { devicesStore } from "./store/devicesStore"
import { serverConfig } from "./store/serverConfigStore"
import FirmwareActions from "./components/FirmwareActions.vue"
import FirmwarePanel from "./components/FirmwarePanel.vue"

const devices = devicesStore
const activeDevice = ref<string | null>(null)
const showConfirm = ref(false)
const showAuth = ref(false)
const pendingConfig = ref<{ id: string; cfg: any } | null>(null)

const device = computed(() =>
    activeDevice.value ? devices[activeDevice.value] ?? {} : {}
)

const firmwareUpdateAvailable = computed(() => {
  if (!activeDevice.value) return false
  const devFw = devices[activeDevice.value]?.firmware
  const latest = serverConfig.latest_firmware
  if (!devFw || !latest) return false
  return devFw.trim() !== latest.trim()
})

const fmt = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--'
  }
  return value.toString()
}

function getColor(id: string) {
  const colors = ['#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#e74c3c']
  const index = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)
  return colors[index % colors.length]
}

async function setActiveDevice(id: string) {
  activeDevice.value = id;
  await loadDeviceData(id);
}

async function saveConfig(id: string, cfg: any) {
  pendingConfig.value = { id, cfg }
  showConfirm.value = true
}

async function confirmSave() {
  if (!pendingConfig.value) return
  const { id, cfg } = pendingConfig.value

  await fetch(`${apiBase}/api/config/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg),
  })

  showConfirm.value = false
  pendingConfig.value = null
}

function authenticate(pin: string) {
  console.log('[Auth] PIN inserito:', pin)
  showAuth.value = false
}

function togglePump(id: string | null, state: 'on' | 'off') {
  if (!id) return
  fetch(`${apiBase}/api/pump/${id}/${state}`, { method: 'POST' })
}

async function loadDeviceData(id: string) {
  const latest = await fetch(`${apiBase}/api/device/${id}/latest`).then(r => r.json());
  const history = await fetch(`${apiBase}/api/history/${id}`).then(r => r.json());

  devices[id] = {
    ...devices[id],
    humidity: latest?.humidity ?? null,
    temperature: latest?.temperature ?? null,
    battery: latest?.battery ?? null,
    rssi: latest?.rssi ?? null,
    firmware: latest?.firmware ?? null,
    lastSeen: latest?.created_at
        ? new Date(latest.created_at).toLocaleTimeString()
        : "--",
    lastUpdate: latest ? new Date(latest.created_at).getTime() : null,
    history,
  }
}

onMounted(async () => {
  // Carica lista device dal backend
  const devList = await fetch("/api/devices").then(r => r.json());

  for (const id of devList) {
    devices[id] = {};
  }

  if (devList.length > 0) {
    activeDevice.value = devList[0];
    await loadDeviceData(devList[0]);
  }

  // MQTT LIVE
  console.log('[MQTT] Connessione al broker...')

  const mqtt = await mqttConnect(
      import.meta.env.VITE_MQTT_URL,
      import.meta.env.VITE_CLIENT_ID,
      (topic, message) => {

        // MATCH: bonsai/<device_id>/status/<field>
        const match = topic.match(/^bonsai\/([^/]+)\/status\/([^/]+)$/)
        if (!match) return

        const id = match[1]
        const field = match[2]
        const value = message

        if (!devices[id]) devices[id] = {}

        devices[id].lastSeen = new Date().toLocaleTimeString()
        devices[id].lastUpdate = Date.now()

        switch (field) {
          case "humidity": devices[id].humidity = Number(value); break
          case "temp": devices[id].temperature = Number(value); break
          case "battery": devices[id].battery = Number(value); break
          case "wifi": devices[id].rssi = Number(value); break
          case "firmware": devices[id].firmware = value; break
        }

        if (!activeDevice.value) activeDevice.value = id
      }
  )

  mqtt.subscribe("bonsai/+/status/#")
  console.log("[MQTT] Sottoscritto a bonsai/+/status/#")

  // Stato online/offline
  setInterval(() => {
    const now = Date.now()
    for (const id in devices) {
      devices[id].status =
          devices[id].lastUpdate && now - devices[id].lastUpdate > 60000
              ? "offline"
              : "online"
    }
  }, 5000)

  // OTA config dal server
  try {
    const res = await fetch("/api/ota/config")
    Object.assign(serverConfig, await res.json())
  } catch {}
})
</script>

<style scoped>
.app {
  font-family: 'Inter', sans-serif;
  color: white;
  background: #111;
  padding: 1rem;
  min-height: 100vh;
  text-align: center;
}

.device-block {
  margin-top: 2rem;
  padding: 1rem;
  border-radius: 10px;
  background: #181818;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

h2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 1.3rem;
}

.empty-state {
  color: #ccc;
  text-align: center;
  margin-top: 40px;
}

.empty-state code {
  background: #222;
  padding: 2px 5px;
  border-radius: 4px;
  color: #6cf;
}

.status-grid {
  display: grid;
  gap: 15px;
  margin: 24px auto;
  max-width: 900px;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 800px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
}

.ota-banner {
  background: #f39c12;
  color: #111;
  padding: 10px;
  border-radius: 8px;
  margin: 10px auto;
  max-width: 500px;
  font-weight: 600;
}
</style>
