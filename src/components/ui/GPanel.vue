<template>
  <div class="game-panel">
    <slot></slot>
  </div>
</template>

<style scoped>
.game-panel {
  position: relative;
  padding: clamp(1.5rem, 3vw, 2.3rem);
  border: 1px solid rgba(150, 168, 194, 0.35);
  border-radius: 1rem;
  background:
    linear-gradient(155deg, rgba(27, 40, 58, 0.95), rgba(13, 20, 31, 0.96)),
    radial-gradient(circle at top right, rgba(212, 166, 94, 0.2), transparent 45%);
  text-align: center;
  backdrop-filter: blur(5px);
  box-shadow:
    0 1rem 2.2rem rgba(0, 0, 0, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 0.09);
  overflow: hidden;
}

.game-panel::before {
  content: '';
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(232, 201, 147, 0.85), transparent);
}
</style>
