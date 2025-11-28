<template>
  <div class="firmware-box card">
    <h3><i class="fas fa-microchip"></i> Firmware OTA</h3>

    <div class="row">
      <div>Installato:</div>
      <div>{{ installed || '--' }}</div>
    </div>

    <div class="row">
      <div>Disponibile:</div>
      <div>{{ latest || '--' }}</div>
    </div>

    <div v-if="updateAvailable" class="alert">
      Aggiornamento disponibile!
    </div>

    <button
        v-if="updateAvailable"
        @click="forceUpdate"
        class="btn-update"
    >
      🚀 Aggiorna ora
    </button>

    <p v-if="msg" class="msg">{{ msg }}</p>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from "vue";
import {serverConfig} from "../store/serverConfigStore";
import {devicesStore} from "../store/devicesStore";
import {apiBase} from "../utils/api";

const props = defineProps<{ deviceId: string }>();

const msg = ref("");

const installed = computed(() => devicesStore[props.deviceId]?.firmware);
const latest = computed(() => serverConfig.latest_firmware);

const updateAvailable = computed(() =>
    installed.value &&
    latest.value &&
    installed.value.trim() !== latest.value.trim()
);

async function forceUpdate() {
  msg.value = "Invio richiesta aggiornamento...";
  const res = await fetch(`${apiBase}/api/ota/update/${props.deviceId}`, { method: "POST" });
  msg.value = res.ok ? "Aggiornamento avviato!" : "Errore aggiornamento";
}
</script>

<style scoped>
.firmware-box {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  margin: 20px auto;
  max-width: 700px;
  color: white;
}
.row {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  color: #ddd;
}
.alert {
  margin-top: 10px;
  padding: 8px;
  background: #e67e22;
  border-radius: 6px;
  text-align: center;
}
.btn-update {
  background: #2ecc71;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  margin-top: 12px;
  color: white;
  cursor: pointer;
}
.msg {
  margin-top: 10px;
  color: #bbb;
}
</style>
