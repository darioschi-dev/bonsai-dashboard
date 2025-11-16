<template>
  <header class="dashboard-header">
    <h1>
      <i class="fas fa-seedling"></i>
      Bonsai MQTT Dashboard
      <span :class="['badge', online ? 'online' : 'offline']">
        {{ online ? 'Online' : 'Offline' }}
      </span>
    </h1>

    <!-- Tabs dinamiche per ogni device -->
    <div v-if="deviceIds.length" class="tabs">
      <button
          v-for="id in deviceIds"
          :key="id"
          :class="['tab', id === activeId ? 'active' : '']"
          @click="$emit('select-device', id)"
      >
        <i class="fas fa-microchip"></i> {{ id }}

        <span
            v-if="devices[id]?.firmware && serverConfig.latest_firmware &&
           devices[id].firmware.trim() !== serverConfig.latest_firmware.trim()"
            class="fw-badge"
        >
    UPDATE
  </span>
      </button>
    </div>

    <div class="controls" v-if="activeId">
      <button class="btn-on" @click="$emit('toggle-pump', 'on')">
        <i class="fas fa-play"></i> Accendi
      </button>
      <button class="btn-off" @click="$emit('toggle-pump', 'off')">
        <i class="fas fa-stop"></i> Spegni
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { serverConfig } from "../store/serverConfigStore"

defineProps<{
  online: boolean
  deviceIds: string[]
  activeId: string | null
  devices: Record<string, any>
}>()

defineEmits<{
  (e: 'toggle-pump', state: 'on' | 'off'): void
  (e: 'select-device', id: string): void
}>()
</script>

<style scoped>
.dashboard-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

h1 {
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
}

.badge {
  font-size: 0.8rem;
  border-radius: 6px;
  padding: 2px 8px;
  text-transform: uppercase;
  margin-left: 8px;
}

.badge.online {
  background: #28a745;
  color: #fff;
}

.badge.offline {
  background: #a00;
  color: #fff;
}

/* Tabs */
.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 10px;
  gap: 6px;
}
.tab {
  background: #1e1e1e;
  border: none;
  border-radius: 6px;
  color: #ccc;
  padding: 6px 12px;
  cursor: pointer;
}
.tab.active {
  background: #2ecc71;
  color: #fff;
}

/* Controls */
.controls {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

button {
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
}

.btn-on {
  background-color: #2ecc71;
}

.btn-off {
  background-color: #e74c3c;
}

.fw-badge {
  background: #e74c3c;
  color: white;
  margin-left: 6px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
}

</style>
