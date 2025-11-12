<template>
  <div class="modal">
    <div class="content">
      <h2>⚠️ Riavvio richiesto</h2>
      <p>Salvando la configurazione il dispositivo si riavvierà.</p>
      <div class="actions">
        <button @click="$emit('confirm')">Conferma</button>
        <button @click="$emit('close')">Annulla</button>
      </div>
    </div>
  </div>
</template>

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
  background: #e67e22;
}
</style>
