<template>
  <div class="firmware card">
    <h3><i class="fas fa-upload"></i> Aggiornamento Firmware OTA</h3>
    <form @submit.prevent="uploadFirmware">
      <label>File firmware (.bin)
        <input type="file" ref="fileInput" accept=".bin" required />
      </label>
      <button type="submit">📤 Carica firmware</button>
    </form>
    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const fileInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const deviceId = 'esp32-1'

async function uploadFirmware() {
  if (!fileInput.value?.files?.[0]) return
  const formData = new FormData()
  formData.append('firmware', fileInput.value.files[0])

  const res = await fetch(`/api/firmware/${deviceId}`, {
    method: 'POST',
    body: formData
  })
  message.value = res.ok ? 'Aggiornamento avviato!' : 'Errore caricamento'
}
</script>

<style scoped>
.firmware {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  margin: 30px auto;
  max-width: 700px;
  color: white;
}
.msg {
  margin-top: 10px;
  color: #aaa;
}
button {
  background: #2ecc71;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  color: white;
  cursor: pointer;
}
</style>
