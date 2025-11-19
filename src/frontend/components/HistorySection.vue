<template>
  <div class="history-block">
    <h3><i class="fas fa-history"></i> Storico letture</h3>

    <button class="reload-btn" @click="load">
      <i class="fas fa-sync-alt"></i> Aggiorna
    </button>

    <div v-if="loading" class="loading">Caricamento...</div>

    <div v-else-if="rows.length === 0" class="empty">Nessun dato storico.</div>

    <table v-else class="history-table">
      <thead>
      <tr>
        <th>Ora</th>
        <th>Umidità</th>
        <th>Temp</th>
        <th>Batt</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td>{{ formatTime(row.created_at) }}</td>
        <td>{{ row.humidity }}</td>
        <td>{{ row.temperature }}</td>
        <td>{{ row.battery }}</td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {HistoryRow} from "../store/devicesStore";

const props = defineProps<{
  deviceId: string
}>()

const rows = ref<HistoryRow[]>([]);
const loading = ref(true)

async function load() {
  loading.value = true
  const res = await fetch(`/api/history/${props.deviceId}`)
  rows.value = await res.json()
  loading.value = false
}

onMounted(load)

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString();
}

</script>

<style scoped>
.history-block {
  margin-top: 2rem;
  padding: 1rem;
  background: #181818;
  border-radius: 10px;
  box-shadow: 0 3px 8px rgba(0,0,0,0.4);
}

.history-table {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #333;
  color: #ddd;
}

.empty {
  color: #aaa;
  text-align: center;
  padding: 1rem;
}

.reload-btn {
  background: #3498db;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}

.loading {
  color: #ccc;
  font-style: italic;
}
</style>
