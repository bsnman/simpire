<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, onUnmounted, ref, watch } from 'vue';

import { GameRenderer } from '../game/render/GameRenderer';
import { useCurrentGameMapStore } from '../stores/currentGame/map';

const props = defineProps<{ gameId: string }>();

type CanvasRefElement = {
  getBoundingClientRect: () => { left: number; top: number };
};

const canvasRef = ref<CanvasRefElement | null>(null);
const renderer = new GameRenderer();
const mapStore = useCurrentGameMapStore();
const { currentMap } = storeToRefs(mapStore);

let stopWatch: (() => void) | null = null;

type CanvasWheelEvent = {
  deltaY: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

const onCanvasWheel = (event: CanvasWheelEvent) => {
  event.preventDefault();

  const canvasElement = canvasRef.value;

  if (!canvasElement) {
    return;
  }

  const rect = canvasElement.getBoundingClientRect();
  renderer.zoomByWheel(event.deltaY, event.clientX - rect.left, event.clientY - rect.top);
};

onMounted(async () => {
  const canvasElement = canvasRef.value;

  if (!canvasElement) {
    return;
  }

  await renderer.init(canvasElement);
  renderer.renderMap(currentMap.value);

  stopWatch = watch(
    currentMap,
    (nextMap) => {
      renderer.renderMap(nextMap);
    },
    { deep: true },
  );
});

onUnmounted(() => {
  if (stopWatch) {
    stopWatch();
  }

  renderer.destroy();
});
</script>

<template>
  <div class="page game-page">
    <canvas :id="props.gameId" ref="canvasRef" class="game-canvas" @wheel="onCanvasWheel"></canvas>
  </div>
</template>

<style scoped>
.game-page {
  display: flex;
  align-items: center;
  justify-content: center;
}

.game-canvas {
  border: 2px solid #555;
  background-color: #222;
  width: 100%;
  height: 98vh;
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
