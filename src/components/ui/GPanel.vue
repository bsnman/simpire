<script setup lang="ts">

</script>

<template>
  <div class="game-panel">
    <slot></slot>
  </div>
</template>

<style scoped>
.game-panel {
  width: 100%;
  height: 100%;

  background-color: #222;
  color: #fff;
  border: 2px solid #555; 
  padding: 1rem;
}
</style>
