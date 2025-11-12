<template>
  <div class="config card">
    <h3><i class="fas fa-cogs"></i> Configurazione Dispositivo</h3>

    <fieldset>
      <legend><i class="fas fa-wifi"></i> Wi-Fi</legend>
      <label>SSID Wi-Fi <input v-model="local.ssid" /></label>
      <label>Password Wi-Fi <input type="password" v-model="local.password" /></label>
    </fieldset>

    <fieldset>
      <legend><i class="fas fa-sliders-h"></i> Parametri</legend>
      <label>Soglia irrigazione (%) <input type="number" v-model.number="local.threshold" /></label>
      <label>Durata pompa (s) <input type="number" v-model.number="local.pump_duration" /></label>
      <label>Intervallo lettura (ms) <input type="number" v-model.number="local.interval" /></label>
      <label><input type="checkbox" v-model="local.use_pump" /> Irrigazione automatica</label>
      <label><input type="checkbox" v-model="local.debug" /> Debug seriale</label>
      <label>Ore di Sleep <input type="number" v-model.number="local.sleep_hours" /></label>
    </fieldset>

    <div class="actions">
      <button @click="$emit('save', local)">💾 Salva configurazione</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
const props = defineProps<{ config?: any }>()
const emit = defineEmits(['save'])
const local = ref<any>({
  ssid: '', password: '',
  threshold: 40, pump_duration: 5, interval: 10000,
  use_pump: true, debug: false, sleep_hours: 0
})

watch(() => props.config, (cfg) => {
  if (cfg) Object.assign(local.value, cfg)
}, { immediate: true })
</script>

<style scoped>
.config {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  max-width: 700px;
  margin: 20px auto;
  color: #fff;
}
fieldset {
  border: 1px solid #333;
  margin-bottom: 15px;
  border-radius: 6px;
}
legend {
  padding: 0 6px;
}
label {
  display: block;
  margin: 6px 0;
  text-align: left;
}
input {
  width: 100%;
  background: #2a2a2a;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 5px;
  margin-top: 4px;
}
button {
  background: #3498db;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  color: white;
  cursor: pointer;
}
</style>
