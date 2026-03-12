<script setup lang="ts">
import { useRouter } from 'vue-router';

import GPanel from '~/components/ui/GPanel.vue';
import GButton from '~/components/ui/GButton.vue';

const router = useRouter();

const startGame = () => {
  router.push('/create-game');
};

const openModelDebug = () => {
  router.push('/model-debug/');
};
</script>

<template>
  <div class="main-menu">
    <div class="menu-aura menu-aura-left" aria-hidden="true"></div>
    <div class="menu-aura menu-aura-right" aria-hidden="true"></div>

    <GPanel class="menu-panel">
      <div class="menu-content">
        <p class="menu-kicker">Turn-Based Strategy Prototype</p>
        <h1 class="game-name">Simpire</h1>
        <p class="menu-tagline">Shape an empire across a living hex world.</p>

        <div class="menu-actions">
          <GButton class="menu-button menu-button-primary" @click="startGame">Start Game</GButton>
          <GButton class="menu-button" @click="openModelDebug">Model Debug</GButton>
          <GButton class="menu-button">Load Game</GButton>
          <GButton class="menu-button">Options</GButton>
          <GButton class="menu-button">Exit</GButton>
        </div>
      </div>
    </GPanel>
  </div>
</template>

<style scoped>
.main-menu {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: clamp(1rem, 4vw, 2.5rem);
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(circle at 18% 18%, rgba(178, 142, 79, 0.2), transparent 45%),
    radial-gradient(circle at 82% 10%, rgba(35, 66, 106, 0.35), transparent 35%),
    radial-gradient(circle at 50% 100%, rgba(16, 33, 45, 0.9), rgba(7, 12, 18, 1) 65%);
}

.menu-aura {
  position: absolute;
  width: clamp(12rem, 32vw, 24rem);
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(48px);
  opacity: 0.45;
  z-index: -1;
}

.menu-aura-left {
  left: -8rem;
  top: -7rem;
  background: rgba(169, 124, 71, 0.8);
}

.menu-aura-right {
  right: -7rem;
  bottom: -6rem;
  background: rgba(42, 92, 132, 0.85);
}

.menu-panel {
  width: min(32rem, 100%);
  animation: panel-enter 600ms cubic-bezier(0.18, 0.82, 0.27, 1) both;
}

.menu-content {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: center;
  gap: 0.9rem;
}

.menu-kicker {
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(225, 229, 237, 0.88);
}

.game-name {
  margin: 0;
  font-size: clamp(2.2rem, 8vw, 4rem);
  line-height: 0.95;
  letter-spacing: 0.03em;
  color: #f3e8d0;
  font-family: 'Cinzel', 'Book Antiqua', Palatino, serif;
  text-shadow: 0 0.25rem 1.1rem rgba(0, 0, 0, 0.5);
}

.menu-tagline {
  margin: 0 auto 0.65rem;
  max-width: 28ch;
  color: rgba(214, 220, 232, 0.9);
  font-size: 1rem;
}

.menu-actions {
  display: grid;
  gap: 0.65rem;
}

.menu-button {
  width: 100%;
  animation: button-enter 520ms ease both;
}

.menu-button:nth-child(1) {
  animation-delay: 90ms;
}

.menu-button:nth-child(2) {
  animation-delay: 170ms;
}

.menu-button:nth-child(3) {
  animation-delay: 250ms;
}

.menu-button:nth-child(4) {
  animation-delay: 330ms;
}

.menu-button:nth-child(5) {
  animation-delay: 410ms;
}

.menu-button-primary {
  font-weight: 700;
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes button-enter {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 700px) {
  .menu-panel {
    width: min(30rem, 100%);
  }

  .menu-content {
    gap: 0.8rem;
  }

  .menu-tagline {
    font-size: 0.95rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-panel,
  .menu-button {
    animation: none;
  }
}
</style>
