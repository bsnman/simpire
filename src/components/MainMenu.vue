<script setup lang="ts">
import GPanel from './ui/GPanel.vue';
import GButton from './ui/GButton.vue';

const startGame = () => {
  console.log('Starting game...')
}

</script>

<template>
  <div class="main-menu">
    <GPanel>
      <div class="menu-content">
        <h1>Main Menu</h1>
        <GButton class="menu-button" @click="startGame">Start Game</GButton>
        <GButton class="menu-button">Load Game</GButton>
        <GButton class="menu-button">Options</GButton>
        <GButton class="menu-button">Exit</GButton>
      </div>
    </GPanel>
  </div>
</template>

<style scoped>

.main-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.menu-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;

  gap: 0.5rem;

  & > .menu-button {
    width: calc(100% - 2rem);
  }
}

</style>
