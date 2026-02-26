<script setup lang="ts"></script>

<template>
  <div class="game-button">
    <slot></slot>
  </div>
</template>

<style scoped>
.game-button {
  background-color: #2f3b52;
  color: #fff;
  border: 2px solid #2f3b52;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 1.2rem;
}
</style>
