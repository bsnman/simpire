<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { productionTypes, type ProductionType } from '~/base/productions';
import { resources } from '~/base/resources';
import { terrainFeatures } from '~/base/terrainFeatures';
import { tiles } from '~/base/tiles';
import GPanel from '~/components/ui/GPanel.vue';
import { GameRenderer } from '~/game/render/GameRenderer';
import type { MapTile } from '~/types/map';
import { useCurrentGameMapStore } from '~/stores/currentGame/map';

const props = defineProps<{ gameId: string }>();

type CanvasRefElement = {
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  requestPointerLock: () => void;
};

type CanvasWheelEvent = {
  deltaY: number;
  clientX: number;
  clientY: number;
  preventDefault: () => void;
};

type CanvasMouseEvent = {
  button: number;
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
  preventDefault: () => void;
};

type CanvasKeyboardEvent = {
  key: string;
  preventDefault: () => void;
};

const canvasRef = ref<CanvasRefElement | null>(null);
const renderer = new GameRenderer();
const mapStore = useCurrentGameMapStore();
const { currentMap } = storeToRefs(mapStore);
const hoveredMapTile = ref<MapTile | null>(null);
const isLeftDragPanning = ref(false);

let stopWatch: (() => void) | null = null;

const PRODUCTION_ORDER: ProductionType[] = ['food', 'hammer', 'gold'];
type ProductionValues = Partial<Record<ProductionType, number>>;

const hoveredTileInfo = computed(() => {
  if (!hoveredMapTile.value) {
    return null;
  }

  const tileDefinition = tiles[hoveredMapTile.value.terrain];
  const terrainFeatureDefinition = hoveredMapTile.value.terrainFeatureId
    ? terrainFeatures[hoveredMapTile.value.terrainFeatureId]
    : null;
  const resourceDefinition = hoveredMapTile.value.resourceId
    ? resources[hoveredMapTile.value.resourceId]
    : null;
  const baseProduction: ProductionValues = tileDefinition.resourceProduction ?? {};
  const terrainFeatureProduction: ProductionValues = terrainFeatureDefinition?.bonusProduction ?? {};
  const resourceProduction: ProductionValues = resourceDefinition?.bonusProduction ?? {};

  return {
    q: hoveredMapTile.value.q,
    r: hoveredMapTile.value.r,
    terrainType: tileDefinition.type,
    terrainName: tileDefinition.name,
    terrainFeatureName: terrainFeatureDefinition?.name ?? null,
    resourceName: resourceDefinition?.name ?? null,
    moveCost: tileDefinition.metadata.moveCost,
    defenseBonus: tileDefinition.metadata.defenseBonus,
    navalPassable: tileDefinition.metadata.navalPassable,
    productions: PRODUCTION_ORDER.map((productionType) => ({
      type: productionType,
      label: productionTypes[productionType].name,
      amount:
        (baseProduction[productionType] ?? 0) +
        (terrainFeatureProduction[productionType] ?? 0) +
        (resourceProduction[productionType] ?? 0),
    })),
  };
});

const onCanvasWheel = (event: CanvasWheelEvent) => {
  event.preventDefault();

  const canvasElement = canvasRef.value;

  if (!canvasElement) {
    return;
  }

  const rect = canvasElement.getBoundingClientRect();
  renderer.zoomByWheel(event.deltaY, event.clientX - rect.left, event.clientY - rect.top);
};

const onCanvasMouseMove = (event: CanvasMouseEvent) => {
  const canvasElement = canvasRef.value;

  if (!canvasElement || globalThis.document.pointerLockElement === canvasElement) {
    return;
  }

  const rect = canvasElement.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;

  if (isLeftDragPanning.value) {
    return;
  }

  renderer.setEdgePointerPosition(pointerX, pointerY, rect.width, rect.height);
  renderer.updateHoveredTileFromScreenPoint(pointerX, pointerY);
};

const onCanvasMouseLeave = () => {
  renderer.clearEdgePointerPosition();
  renderer.clearHoveredTile();
};

const onCanvasMouseDown = (event: CanvasMouseEvent) => {
  if (event.button !== 0 && event.button !== 2) {
    return;
  }

  const canvasElement = canvasRef.value;

  if (!canvasElement) {
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    canvasElement.requestPointerLock();
    return;
  }

  if (globalThis.document.pointerLockElement === canvasElement) {
    return;
  }

  event.preventDefault();
  isLeftDragPanning.value = true;
  renderer.clearEdgePointerPosition();
};

const onPointerLockChange = () => {
  const isLocked = globalThis.document.pointerLockElement === canvasRef.value;
  isLeftDragPanning.value = false;
  renderer.setPointerLockActive(isLocked);
};

const onPointerLockError = () => {
  renderer.setPointerLockActive(false);
};

const onWindowMouseMove = (event: CanvasMouseEvent) => {
  if (globalThis.document.pointerLockElement === canvasRef.value) {
    renderer.panByPointerLockMovement(event.movementX, event.movementY);
    return;
  }

  if (!isLeftDragPanning.value) {
    return;
  }

  renderer.panByDragMovement(event.movementX, event.movementY);
};

const onWindowMouseUp = (event: CanvasMouseEvent) => {
  if (event.button !== 0) {
    return;
  }

  isLeftDragPanning.value = false;
};

const onWindowKeyDown = (event: CanvasKeyboardEvent) => {
  if (
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight' &&
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown'
  ) {
    return;
  }

  event.preventDefault();
  renderer.setArrowKeyPanPressed(event.key, true);
};

const onWindowKeyUp = (event: CanvasKeyboardEvent) => {
  if (
    event.key !== 'ArrowLeft' &&
    event.key !== 'ArrowRight' &&
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown'
  ) {
    return;
  }

  renderer.setArrowKeyPanPressed(event.key, false);
};

const onWindowBlur = () => {
  isLeftDragPanning.value = false;
  renderer.clearEdgePointerPosition();
  renderer.clearArrowKeyPan();
  renderer.clearHoveredTile();
};

onMounted(async () => {
  const canvasElement = canvasRef.value;

  if (!canvasElement) {
    return;
  }

  await renderer.init(canvasElement);
  renderer.setHoveredTileChangeHandler((nextHoveredTile) => {
    hoveredMapTile.value = nextHoveredTile?.tile ?? null;
  });
  renderer.renderMap(currentMap.value);
  globalThis.document.addEventListener('pointerlockchange', onPointerLockChange);
  globalThis.document.addEventListener('pointerlockerror', onPointerLockError);
  globalThis.window.addEventListener('mousemove', onWindowMouseMove);
  globalThis.window.addEventListener('mouseup', onWindowMouseUp);
  globalThis.window.addEventListener('keydown', onWindowKeyDown);
  globalThis.window.addEventListener('keyup', onWindowKeyUp);
  globalThis.window.addEventListener('blur', onWindowBlur);

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

  globalThis.document.removeEventListener('pointerlockchange', onPointerLockChange);
  globalThis.document.removeEventListener('pointerlockerror', onPointerLockError);
  globalThis.window.removeEventListener('mousemove', onWindowMouseMove);
  globalThis.window.removeEventListener('mouseup', onWindowMouseUp);
  globalThis.window.removeEventListener('keydown', onWindowKeyDown);
  globalThis.window.removeEventListener('keyup', onWindowKeyUp);
  globalThis.window.removeEventListener('blur', onWindowBlur);
  isLeftDragPanning.value = false;
  renderer.setPointerLockActive(false);
  renderer.clearEdgePointerPosition();
  renderer.clearArrowKeyPan();
  renderer.clearHoveredTile();
  renderer.setHoveredTileChangeHandler(null);

  if (globalThis.document.pointerLockElement === canvasRef.value) {
    globalThis.document.exitPointerLock();
  }

  renderer.destroy();
});
</script>

<template>
  <div class="page game-page">
    <canvas
      :id="props.gameId"
      ref="canvasRef"
      class="game-canvas"
      @wheel="onCanvasWheel"
      @mousemove="onCanvasMouseMove"
      @mouseleave="onCanvasMouseLeave"
      @mousedown="onCanvasMouseDown"
      @contextmenu.prevent
    ></canvas>

    <GPanel v-if="hoveredTileInfo" class="tile-hover-panel">
      <div class="tile-hover-content">
        <p class="tile-hover-kicker">Tile</p>
        <h2 class="tile-hover-title">{{ hoveredTileInfo.terrainName }}</h2>
        <p class="tile-hover-coord">
          Type: {{ hoveredTileInfo.terrainType }} | q: {{ hoveredTileInfo.q }}, r:
          {{ hoveredTileInfo.r }}
        </p>
        <p class="tile-hover-coord">Feature: {{ hoveredTileInfo.terrainFeatureName ?? 'None' }}</p>
        <p class="tile-hover-coord">Resource: {{ hoveredTileInfo.resourceName ?? 'None' }}</p>

        <dl class="tile-hover-stats">
          <div class="tile-hover-stat-row">
            <dt>Move Cost</dt>
            <dd>{{ hoveredTileInfo.moveCost }}</dd>
          </div>
          <div class="tile-hover-stat-row">
            <dt>Defense</dt>
            <dd>+{{ hoveredTileInfo.defenseBonus }}</dd>
          </div>
          <div class="tile-hover-stat-row">
            <dt>Naval Passable</dt>
            <dd>{{ hoveredTileInfo.navalPassable ? 'Yes' : 'No' }}</dd>
          </div>
        </dl>

        <div class="tile-hover-production">
          <p class="tile-hover-section-label">Production</p>
          <ul class="tile-hover-production-list">
            <li
              v-for="production in hoveredTileInfo.productions"
              :key="production.type"
              class="tile-hover-production-row"
            >
              <span>{{ production.label }}</span>
              <strong>{{ production.amount }}</strong>
            </li>
          </ul>
        </div>
      </div>
    </GPanel>
  </div>
</template>

<style scoped>
.game-page {
  position: relative;
  display: grid;
  min-height: 100%;
  background:
    radial-gradient(circle at 12% 12%, rgba(42, 92, 132, 0.24), transparent 48%),
    radial-gradient(circle at 88% 86%, rgba(169, 124, 71, 0.2), transparent 46%),
    #070c12;
}

.game-canvas {
  border: 1px solid rgba(150, 168, 194, 0.32);
  background-color: #101418;
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

.tile-hover-panel {
  position: absolute;
  left: clamp(0.8rem, 2vw, 1.5rem);
  bottom: clamp(0.8rem, 2vw, 1.5rem);
  width: min(22rem, calc(100vw - 1.6rem));
  padding: clamp(1rem, 2vw, 1.2rem);
  border-color: rgba(150, 168, 194, 0.42);
  background:
    linear-gradient(162deg, rgba(27, 40, 58, 0.8), rgba(13, 20, 31, 0.82)),
    radial-gradient(circle at top right, rgba(212, 166, 94, 0.22), transparent 50%);
  text-align: left;
  pointer-events: none;
  animation: tile-panel-enter 180ms ease-out both;
}

.tile-hover-content {
  display: grid;
  gap: 0.5rem;
}

.tile-hover-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(225, 229, 237, 0.82);
}

.tile-hover-title {
  margin: 0;
  color: #f3e8d0;
  font-family: 'Cinzel', 'Book Antiqua', Palatino, serif;
  font-size: 1.2rem;
  line-height: 1.05;
}

.tile-hover-coord {
  margin: 0;
  color: rgba(214, 220, 232, 0.9);
  font-size: 0.84rem;
}

.tile-hover-stats {
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.2rem;
}

.tile-hover-stat-row {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  color: #f5f7fb;
  font-size: 0.88rem;
}

.tile-hover-stat-row dt,
.tile-hover-stat-row dd {
  margin: 0;
}

.tile-hover-production {
  display: grid;
  gap: 0.2rem;
}

.tile-hover-section-label {
  margin: 0;
  color: rgba(225, 229, 237, 0.88);
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tile-hover-production-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.1rem;
}

.tile-hover-production-row {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  color: #f5f7fb;
  font-size: 0.87rem;
}

@keyframes tile-panel-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
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

@media (prefers-reduced-motion: reduce) {
  .tile-hover-panel {
    animation: none;
  }
}
</style>
