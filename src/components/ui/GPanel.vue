<script setup lang="ts"></script>

<template>
  <div class="game-panel">
    <slot></slot>
  </div>
</template>

<style scoped>
.game-panel {
  padding: 2rem 2.5rem;
  border: 1px solid #2f3b52;
  border-radius: 12px;
  background: rgba(10, 14, 24, 0.6);
  text-align: center;
}
</style>
