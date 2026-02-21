<script setup lang="ts">
import GPanel from './ui/GPanel.vue';
import GButton from './ui/GButton.vue';

const startGame = () => {
  console.log('Starting game...')
}

</script>

<template>
  
  <GPanel>
    <div class="main-menu">
      <h1>Main Menu</h1>
      <GButton @click="startGame">Start Game</GButton>
      <GButton>Load Game</GButton>
      <GButton>Options</GButton>
      <GButton>Exit</GButton>
    </div>
  </GPanel>
</template>

<style scoped>

.main-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;

  gap: 0.5rem;
}

</style>
