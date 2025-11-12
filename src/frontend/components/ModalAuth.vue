<template>
  <div class="modal">
    <div class="content">
      <h2>🔒 Autenticazione richiesta</h2>
      <input v-model="pin" type="password" placeholder="Inserisci PIN" inputmode="numeric" />
      <div class="actions">
        <button @click="$emit('auth', pin)">Conferma</button>
        <button @click="$emit('close')">Annulla</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const pin = ref('')
</script>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.content {
  background: #222;
  color: white;
  border-radius: 12px;
  padding: 20px;
  width: 300px;
}
.actions {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
}
button {
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  color: white;
  background: #3498db;
}
</style>
