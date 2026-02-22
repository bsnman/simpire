<script setup lang="ts">
const props = defineProps<{ id: string }>();
</script>

<template>
  <div class="page game-page">
    <div class="game-panel">
      <h1>Game</h1>
      <p>Now playing game ID: <strong>{{ props.id }}</strong></p>
      <RouterLink class="back-link" to="/home">Back to home</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.game-panel {
  padding: 2rem 2.5rem;
  border: 1px solid #2f3b52;
  border-radius: 12px;
  background: rgba(10, 14, 24, 0.6);
  text-align: center;
}

.back-link {
  display: inline-block;
  margin-top: 1.5rem;
  color: #7eb4ff;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}
</style>
