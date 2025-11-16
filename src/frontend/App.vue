<template>
  <div class="app">
    <!-- HEADER SEMPRE VISIBILE -->
    <DashboardHeader
        :online="Object.keys(devices).length > 0"
        :active-id="activeDevice"
        :device-ids="Object.keys(devices)"
        :devices="devices"
    @toggle-pump="(s) => togglePump(activeDevice, s)"
    @select-device="setActiveDevice"
    />

    <!-- MESSAGGIO INFORMATIVO, NON BLOCCA PIÙ LA UI -->
    <div v-if="Object.keys(devices).length === 0" class="empty-state">
      <p>Nessun dispositivo connesso.</p>
      <p class="hint">
        In attesa di dati MQTT dal topic
        <code>bonsai/&lt;device_id&gt;/data</code>…
      </p>
    </div>

    <!-- DASHBOARD SEMPRE VISIBILE -->
    <div class="device-block">

      <!-- GRID DELLE METRICHE SEMPRE VISIBILE -->
      <div class="status-grid">
        <DashboardCard icon="tint" label="Umidità" :value="fmt(device.humidity)" />
        <DashboardCard icon="battery-half" label="Batteria" :value="fmt(device.battery)" />
        <DashboardCard icon="temperature-low" label="Temperatura" :value="fmt(device.temperature)" />
        <DashboardCard icon="wifi" label="WiFi RSSI" :value="fmt(device.rssi)" />
        <DashboardCard icon="clock" label="Ultimo messaggio" :value="device.lastSeen ?? '--'" />
        <DashboardCard icon="microchip" label="Firmware" :value="device.firmware ?? '--'" />
      </div>

      <!-- TITOLO ***
       VA SOTTO IL GRID *** -->
      <h2 v-if="activeDevice" :style="{ color: getColor(activeDevice) }">
        <i class="fas fa-microchip"></i> {{ activeDevice }}
      </h2>

      <h2 v-else>
        <i class="fas fa-microchip"></i> Nessun dispositivo selezionato
      </h2>

      <!-- GRAFICI -->
      <HumidityChart :humidity="device.humidity ?? 0" />
      <HistorySection v-if="activeDevice" :device-id="activeDevice" />

      <DeviceConfig
          v-if="activeDevice"
          :device-id="activeDevice"
          @save="(cfg) => saveConfig(activeDevice!, cfg)"
      />

      <FirmwareActions v-if="activeDevice" :device-id="activeDevice" />

      <div
          v-if="firmwareUpdateAvailable"
          class="ota-banner"
      >
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
import FirmwareActions from "./components/FirmwareActions.vue";

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

function fmt(value?: number) {
  return value != null ? `${value}` : '--'
}

function getColor(id: string) {
  const colors = ['#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#e74c3c']
  const index = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0)
  return colors[index % colors.length]
}

function setActiveDevice(id: string) {
  activeDevice.value = id
}

async function saveConfig(id: string, cfg: any) {
  pendingConfig.value = { id, cfg }
  showConfirm.value = true
}

async function confirmSave() {
  if (!pendingConfig.value) return
  const { id, cfg } = pendingConfig.value

  await fetch(`/api/config/${id}`, {
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
  fetch(`/api/pump/${id}/${state}`, { method: 'POST' })
}

onMounted(async () => {
  console.log('[MQTT] Connessione al broker...')

  const mqtt = await mqttConnect(
      import.meta.env.VITE_MQTT_URL,
      import.meta.env.VITE_CLIENT_ID,
      (topic, message) => {
        const match = topic.match(/^bonsai\/([^/]+)\/data$/)
        if (!match) return

        const id = match[1]
        const data = JSON.parse(message)

        devices[id] = {
          ...devices[id],
          humidity: data.humidity,
          temperature: data.temperature,
          battery: data.battery,
          rssi: data.rssi,
          firmware: data.firmware,
          lastSeen: new Date().toLocaleTimeString(),
          lastUpdate: Date.now(),
        }

        if (!activeDevice.value) activeDevice.value = id
      }
  )

  mqtt.subscribe("bonsai/#") // Più permissivo durante sviluppo
  console.log("[MQTT] Sottoscritto a bonsai/#")

  // Stato online / offline
  setInterval(() => {
    const now = Date.now()
    for (const id in devices) {
      devices[id].status =
          devices[id].lastUpdate && now - devices[id].lastUpdate > 60000
              ? "offline"
              : "online"
    }
  }, 5000)

  try {
    const res = await fetch("/api/ota/config");
    Object.assign(serverConfig, await res.json());
    console.log("[OTA] Config ricevuta:", serverConfig);
  } catch (e) {
    console.warn("Nessuna OTA config disponibile");
  }

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

  /* 3 colonne perfettamente simmetriche */
  grid-template-columns: repeat(3, 1fr);
}

/* responsive mobile/tablet */
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
