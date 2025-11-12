<template>
  <div class="card">
    <h3>{{ deviceId }}</h3>
    <p>Umidità: {{ latest?.humidity ?? '...' }}%</p>
    <button @click="togglePump('on')">Accendi pompa</button>
    <button @click="togglePump('off')">Spegni pompa</button>
    <button class="config-btn" @click="$emit('open-config', deviceId)">⚙️ Configura</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
const props = defineProps<{ deviceId: string }>()
const latest = ref<{ humidity: number } | null>(null)

async function loadData() {
  const res = await fetch(`/api/readings/${props.deviceId}`)
  const data = await res.json()
  latest.value = data[0]
}
async function togglePump(action: 'on' | 'off') {
  await fetch(`/api/pump/${props.deviceId}/${action}`, { method: 'POST' })
}
onMounted(() => {
  loadData()
  setInterval(loadData, 5000)
})
</script>

<style scoped>
.card { background:#fff;border-radius:10px;padding:10px;margin:10px;width:200px;
  box-shadow:0 2px 4px rgba(0,0,0,0.1);}
button {margin:3px;}
.config-btn {background:#ddd;}
</style>
