<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { productionTypes, type ProductionType } from '~/base/productions';
import { resources } from '~/base/resources';
import { terrainFeatures } from '~/base/terrainFeatures';
import { tiles } from '~/base/tiles';
import GButton from '~/components/ui/GButton.vue';
import GPanel from '~/components/ui/GPanel.vue';
import {
  buildMapgenReproPayload,
  calculateMapQualityMetricsForMap,
  createMapDigest,
  parseMapgenReplayInput,
  stringifyMapgenReproPayload,
} from '~/game/mapgen/repro';
import { GameRenderer } from '~/game/render/GameRenderer';
import type { MapTile } from '~/types/map';
import { useCurrentGameMapStore } from '~/stores/currentGame/map';
import { useMapgenDebugStore } from '~/stores/debugger/mapgen';

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
const mapgenDebugStore = useMapgenDebugStore();
const { currentMap, lastGenerationRequest } = storeToRefs(mapStore);
const { isEnabled: isMapgenDebugEnabled, includeFullMapData } = storeToRefs(mapgenDebugStore);
const hoveredMapTile = ref<MapTile | null>(null);
const isLeftDragPanning = ref(false);
const mapgenDebugStatus = ref('');
const mapgenDebugError = ref('');

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

const mapgenMetrics = computed(() =>
  calculateMapQualityMetricsForMap(lastGenerationRequest.value, currentMap.value),
);

const mapgenDigest = computed(() => createMapDigest(currentMap.value));
const mapgenParamsJson = computed(() =>
  JSON.stringify(lastGenerationRequest.value.params ?? {}, null, 2),
);

const clearMapgenFeedback = () => {
  mapgenDebugStatus.value = '';
  mapgenDebugError.value = '';
};

const toggleMapgenDebugPanel = () => {
  mapgenDebugStore.toggleEnabled();
  clearMapgenFeedback();
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!globalThis.navigator?.clipboard?.writeText) {
    return false;
  }

  await globalThis.navigator.clipboard.writeText(text);
  return true;
};

const copyMapgenReproPayload = async () => {
  clearMapgenFeedback();

  const payload = buildMapgenReproPayload({
    request: lastGenerationRequest.value,
    map: currentMap.value,
    includeFullMapData: includeFullMapData.value,
  });
  const serializedPayload = stringifyMapgenReproPayload(payload);
  mapgenDebugStore.setLastReproPayload(payload);

  try {
    const copied = await copyToClipboard(serializedPayload);

    if (copied) {
      mapgenDebugStatus.value = 'Repro payload copied to clipboard.';
      return;
    }

    globalThis.window.prompt('Copy mapgen repro JSON', serializedPayload);
    mapgenDebugStatus.value = 'Clipboard API unavailable. Payload shown in prompt for manual copy.';
  } catch (error) {
    mapgenDebugError.value =
      error instanceof Error ? error.message : 'Failed to copy repro payload.';
  }
};

const replayFromPastedPayload = () => {
  clearMapgenFeedback();

  const pasted = globalThis.window.prompt('Paste mapgen repro JSON or raw request JSON');

  if (!pasted) {
    return;
  }

  const parsed = parseMapgenReplayInput(pasted);

  if (!parsed.ok) {
    mapgenDebugError.value = parsed.error;
    return;
  }

  mapStore.generateMap(parsed.value.request);

  const currentDigest = createMapDigest(currentMap.value);
  const hasExpectedDigest = Boolean(parsed.value.expectedMapDigest);
  const digestMatches = parsed.value.expectedMapDigest === currentDigest;
  const replayPayload =
    parsed.value.payload ??
    buildMapgenReproPayload({
      request: parsed.value.request,
      map: currentMap.value,
      includeFullMapData: false,
    });

  mapgenDebugStore.setLastReproPayload(replayPayload);

  if (hasExpectedDigest) {
    mapgenDebugStatus.value = digestMatches
      ? 'Replay succeeded and map digest matches payload.'
      : `Replay generated different digest (expected ${parsed.value.expectedMapDigest}, got ${currentDigest}).`;
    return;
  }

  mapgenDebugStatus.value = 'Replay succeeded from pasted request.';
};

const regenerateMapWithSameSeed = () => {
  clearMapgenFeedback();
  mapStore.regenerateMap(lastGenerationRequest.value.seedHash);
  mapgenDebugStatus.value = `Regenerated map with seed "${lastGenerationRequest.value.seedHash}".`;
};

const setIncludeFullMapData = (event: { target: unknown }) => {
  const target = event.target as { checked?: unknown } | null;
  mapgenDebugStore.setIncludeFullMapData(target?.checked === true);
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

    <GButton class="mapgen-debug-toggle" @click="toggleMapgenDebugPanel">
      {{ isMapgenDebugEnabled ? 'Hide Map Debug' : 'Show Map Debug' }}
    </GButton>

    <GPanel v-if="isMapgenDebugEnabled" class="mapgen-debug-panel">
      <div class="mapgen-debug-content">
        <p class="mapgen-debug-kicker">Map Generation Debug</p>
        <p class="mapgen-debug-row">Algorithm: {{ lastGenerationRequest.algorithmId }}</p>
        <p class="mapgen-debug-row">Seed: {{ lastGenerationRequest.seedHash }}</p>
        <p class="mapgen-debug-row">
          Size: {{ lastGenerationRequest.width }}x{{ lastGenerationRequest.height }}
        </p>
        <p class="mapgen-debug-row">
          Directionality: {{ mapgenMetrics.directionalityScore.toFixed(4) }} (axis
          {{ mapgenMetrics.dominantAxis }})
        </p>
        <p class="mapgen-debug-row">Digest: {{ mapgenDigest }}</p>
        <p class="mapgen-debug-row mapgen-debug-row-spaced">Params</p>
        <pre class="mapgen-debug-json">{{ mapgenParamsJson }}</pre>

        <label class="mapgen-debug-checkbox-row">
          <input
            type="checkbox"
            :checked="includeFullMapData"
            @change="setIncludeFullMapData"
          />
          Include full map tile data when copying payload
        </label>

        <div class="mapgen-debug-actions">
          <GButton class="mapgen-debug-action" @click="copyMapgenReproPayload">
            Copy Repro JSON
          </GButton>
          <GButton class="mapgen-debug-action" @click="replayFromPastedPayload">
            Paste + Replay
          </GButton>
          <GButton class="mapgen-debug-action" @click="regenerateMapWithSameSeed">
            Regenerate Same Seed
          </GButton>
        </div>

        <p v-if="mapgenDebugStatus" class="mapgen-debug-status">{{ mapgenDebugStatus }}</p>
        <p v-if="mapgenDebugError" class="mapgen-debug-error">{{ mapgenDebugError }}</p>
      </div>
    </GPanel>

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

.mapgen-debug-toggle {
  position: absolute;
  top: clamp(0.8rem, 2vw, 1.3rem);
  right: clamp(0.8rem, 2vw, 1.3rem);
  z-index: 3;
}

.mapgen-debug-panel {
  position: absolute;
  top: clamp(3.9rem, 8vw, 4.3rem);
  right: clamp(0.8rem, 2vw, 1.3rem);
  width: min(30rem, calc(100vw - 1.6rem));
  padding: 0.85rem;
  z-index: 2;
}

.mapgen-debug-content {
  display: grid;
  gap: 0.4rem;
}

.mapgen-debug-kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: rgba(225, 229, 237, 0.88);
}

.mapgen-debug-row {
  margin: 0;
  color: rgba(214, 220, 232, 0.95);
  font-size: 0.84rem;
  line-height: 1.35;
  word-break: break-word;
}

.mapgen-debug-row-spaced {
  margin-top: 0.2rem;
}

.mapgen-debug-json {
  margin: 0;
  padding: 0.55rem 0.62rem;
  max-height: 8.5rem;
  overflow: auto;
  border-radius: 0.55rem;
  border: 1px solid rgba(176, 189, 209, 0.28);
  background: rgba(9, 15, 24, 0.8);
  color: #f5f7fb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 0.74rem;
  line-height: 1.4;
}

.mapgen-debug-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.12rem;
  color: rgba(214, 220, 232, 0.92);
  font-size: 0.8rem;
}

.mapgen-debug-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
  margin-top: 0.1rem;
}

.mapgen-debug-action {
  width: 100%;
}

.mapgen-debug-status {
  margin: 0.1rem 0 0;
  color: #d8f3dd;
  font-size: 0.8rem;
}

.mapgen-debug-error {
  margin: 0.1rem 0 0;
  color: #ffd3c7;
  font-size: 0.8rem;
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
