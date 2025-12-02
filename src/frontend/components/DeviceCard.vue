<template>
  <div class="card">
    <h3>{{ deviceId }}</h3>

    <p>
      <strong>Stato:</strong>
      <span :style="{ color: statusColor }">
        {{ device.status ?? 'offline' }}
      </span>
    </p>

    <p>Umidità: {{ device.humidity ?? '--' }}%</p>
    <p>Temperatura: {{ device.temperature ?? '--' }}°C</p>
    <p>Batteria: {{ device.battery ?? '--' }}%</p>

    <button @click="togglePump('on')">Accendi pompa</button>
    <button @click="togglePump('off')">Spegni pompa</button>

    <button class="config-btn" @click="$emit('open-config', deviceId)">
      ⚙️ Configura
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {devicesStore} from "../store/devicesStore";
import {apiBase} from "../utils/api";

const props = defineProps<{ deviceId: string }>()

const device = computed(() => devicesStore[props.deviceId] ?? {})

const statusColor = computed(() =>
    device.value.status === "online" ? "#2ecc71"
        : device.value.status === "offline" ? "#e74c3c"
            : "#bbb"
)

async function togglePump(action: 'on' | 'off') {
  await fetch(`${apiBase}/api/pump/${props.deviceId}/${action}`, { method: 'POST' })
}
</script>

<style scoped>
.card {
  background:#fff;
  border-radius:10px;
  padding:10px;
  margin:10px;
  width:200px;
  box-shadow:0 2px 4px rgba(0,0,0,0.1);
  color: #222;
}
button { margin:3px; }
.config-btn { background:#ddd; }
</style>
