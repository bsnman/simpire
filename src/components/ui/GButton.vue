<template>
  <button type="button" class="game-button">
    <slot></slot>
  </button>
</template>

<style scoped>
.game-button {
  border: 1px solid rgba(176, 189, 209, 0.34);
  border-radius: 0.72rem;
  background: linear-gradient(160deg, #32455f, #1f2d3f);
  color: #f5f7fb;
  padding: 0.7rem 1rem;
  cursor: pointer;
  font-size: 1rem;
  letter-spacing: 0.02em;
  font-family: 'Gill Sans', 'Trebuchet MS', sans-serif;
  transition:
    transform 140ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.game-button:hover {
  border-color: rgba(232, 198, 146, 0.7);
  background: linear-gradient(160deg, #405a7b, #2a3c54);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.28);
}

.game-button:active {
  transform: translateY(1px) scale(0.995);
}

.game-button:focus-visible {
  outline: 2px solid rgba(245, 213, 150, 0.95);
  outline-offset: 2px;
}

.game-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
