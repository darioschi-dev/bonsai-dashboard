<template>
  <div class="card">
    <i :class="['fas', 'fa-' + icon]"></i>
    <h3>{{ label }}</h3>
    <div class="value">{{ value }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; label: string; value: string | number }>()
</script>

<style scoped>
.card {
  background: #222;
  color: white;
  border-radius: 12px;
  padding: 15px;
  text-align: center;
}
.card i {
  font-size: 1.3rem;
  margin-bottom: 5px;
}
.value {
  font-size: 1.2rem;
  font-weight: bold;
}
</style>
