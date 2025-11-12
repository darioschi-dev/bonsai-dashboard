<template>
  <section class="humidity-section">
    <div class="chart-container">
      <h3><i class="fas fa-tint"></i> Umidità Attuale</h3>
      <canvas ref="gaugeCanvas" width="200" height="200"></canvas>
    </div>

    <div class="chart-container">
      <h3><i class="fas fa-chart-line"></i> Storico Umidità</h3>
      <canvas ref="historyCanvas" height="120"></canvas>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps<{ humidity: number }>()

const gaugeCanvas = ref<HTMLCanvasElement | null>(null)
const historyCanvas = ref<HTMLCanvasElement | null>(null)
let gaugeChart: Chart | null = null
let historyChart: Chart | null = null

// Mantiene uno storico locale per il grafico
const historyData: { time: string; value: number }[] = []

onMounted(() => {
  if (gaugeCanvas.value) {
    gaugeChart = new Chart(gaugeCanvas.value, {
      type: 'doughnut',
      data: {
        labels: ['Umidità', 'Asciutto'],
        datasets: [
          {
            data: [props.humidity, 100 - props.humidity],
            backgroundColor: ['#2ecc71', '#333'],
            borderWidth: 0
          }
        ]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    })
  }

  if (historyCanvas.value) {
    historyChart = new Chart(historyCanvas.value, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Umidità (%)',
            data: [],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#fff' } } },
        scales: {
          x: { ticks: { color: '#aaa' } },
          y: { min: 0, max: 100, ticks: { color: '#aaa' } }
        }
      }
    })
  }
})

watch(
    () => props.humidity,
    (newValue) => {
      if (!gaugeChart || !historyChart) return

      // Aggiorna il gauge
      gaugeChart.data.datasets[0].data = [newValue, 100 - newValue]
      gaugeChart.update()

      // Aggiorna storico
      const time = new Date().toLocaleTimeString()
      historyData.push({ time, value: newValue })
      if (historyData.length > 20) historyData.shift()

      historyChart.data.labels = historyData.map((p) => p.time)
      historyChart.data.datasets[0].data = historyData.map((p) => p.value)
      historyChart.update()
    }
)
</script>

<style scoped>
.humidity-section {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 30px;
  margin: 30px auto;
  max-width: 800px;
  color: white;
}

.chart-container {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  width: 340px;
}

h3 {
  font-weight: normal;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #ccc;
}

canvas {
  display: block;
  margin: 0 auto;
}
</style>
