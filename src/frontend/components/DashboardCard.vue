<template>
  <div class="card">
    <div class="icon-wrapper">
      <i :class="['fas', 'fa-' + icon]"></i>
    </div>

    <div class="label">{{ label }}</div>

    <div class="value">
      {{ displayValue }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{ icon: string; label: string; value: string | number }>()

// Mostra '--' in modo coerente
const displayValue = computed(() =>
    props.value === null || props.value === undefined || props.value === ''
        ? '--'
        : props.value
)
</script>

<style scoped>
.card {
  background: #1c1c1c;
  color: white;

  border-radius: 14px;
  padding: 18px 14px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;

  min-height: 130px; /* ✔ altezza consistente */
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);

  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* Hover */
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
}

.icon-wrapper {
  font-size: 1.7rem;     /* icona più visibile */
  opacity: 0.9;
  margin-bottom: 6px;
}

.label {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-bottom: 6px;
}

.value {
  font-size: 1.4rem;
  font-weight: 600;
}
</style>
