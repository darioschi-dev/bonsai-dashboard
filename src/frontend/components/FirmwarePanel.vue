<template>
  <div class="fw-panel card">
    <h3><i class="fas fa-microchip"></i> Firmware</h3>

    <!-- Nessun device selezionato -->
    <div v-if="!device">
      <p class="empty">Nessun dispositivo selezionato.</p>
    </div>

    <!-- Device OK -->
    <div v-else>
      <div class="row">
        <span class="label">Firmware installato</span>
        <span class="value fw-installed">
          {{ device.firmware ?? '--' }}
        </span>
      </div>

      <div class="row">
        <span class="label">Firmware disponibile</span>
        <span class="value fw-latest">
          {{ serverConfig.latest_firmware ?? '--' }}
        </span>
      </div>

      <div class="row" v-if="serverConfig.latest_firmware_size">
        <span class="label">Dimensione</span>
        <span class="value">{{ formatSize(serverConfig.latest_firmware_size) }}</span>
      </div>

      <div class="row" v-if="serverConfig.latest_firmware">
        <span class="label">Pubblicato il</span>
        <span class="value">{{ formatDate(serverConfig.latest_firmware_updated_at) }}</span>
      </div>

      <p v-if="needsUpdate" class="warn">
        <i class="fas fa-exclamation-triangle"></i>
        Aggiornamento disponibile
      </p>

      <button
          class="btn-update"
          :disabled="!needsUpdate || updating"
          @click="startUpdate"
      >
        <i class="fas fa-upload"></i>
        {{ updating ? 'Aggiornamento in corso...' : 'Aggiorna ora' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { devicesStore } from "../store/devicesStore"
import { serverConfig } from "../store/serverConfigStore"

// Props
const props = defineProps<{
  deviceId: string | null
}>()

const updating = ref(false)

const device = computed(() => {
  if (!props.deviceId) return null
  return devicesStore[props.deviceId] ?? null
})

// verifica compatibilità semver base semplicissima
const needsUpdate = computed(() => {
  if (!device.value?.firmware) return false
  if (!serverConfig.latest_firmware) return false
  return device.value.firmware.trim() !== serverConfig.latest_firmware.trim()
})

function formatSize(bytes: number) {
  if (!bytes) return "--"
  return (bytes / 1024 / 1024).toFixed(2) + " MB"
}

function formatDate(d: string | undefined) {
  if (!d) return "--"
  const dt = new Date(d)
  return dt.toLocaleString()
}

async function startUpdate() {
  if (!props.deviceId) return
  if (!serverConfig.latest_firmware_url) return

  updating.value = true

  try {
    const res = await fetch(`/api/ota/update/${props.deviceId}`, {
      method: "POST"
    })

    if (!res.ok) {
      alert("Errore durante l'invio dell'aggiornamento.")
    } else {
      alert("Aggiornamento inviato al dispositivo.")
    }
  } catch (e) {
    console.error("OTA update error", e)
    alert("Errore di rete durante l'aggiornamento.")
  } finally {
    updating.value = false
  }
}
</script>

<style scoped>
.fw-panel {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  max-width: 700px;
  margin: 20px auto;
  color: #fff;
}

.row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #333;
  padding: 6px 0;
  margin-bottom: 4px;
}

.label {
  color: #aaa;
}

.value {
  color: #fff;
}

.warn {
  color: #e67e22;
  margin-top: 10px;
  font-weight: bold;
}

.btn-update {
  margin-top: 15px;
  background: #2ecc71;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}

.btn-update:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
