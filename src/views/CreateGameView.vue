<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import GButton from '~/components/ui/GButton.vue';
import GNumberInput from '~/components/ui/GNumberInput.vue';
import GPanel from '~/components/ui/GPanel.vue';
import GSelect from '~/components/ui/GSelect.vue';
import {
  getMapGenerator,
  listMapGenerators,
  type MapGenerationRequest,
  type MapGeneratorNumericParameterDefinition,
} from '~/game/mapgen';
import { useCurrentGameMapStore } from '~/stores/currentGame/map';

type GeneratorOption = {
  id: string;
  label: string;
  description: string;
};

type MapSizeOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type GeneratorParams = Record<string, number>;

const MAP_SIZE_OPTIONS: MapSizeOption[] = [
  { id: 'tiny', label: 'Tiny (40x40)', width: 40, height: 40 },
  { id: 'small', label: 'Small (50x50)', width: 50, height: 50 },
  { id: 'medium', label: 'Medium (60x60)', width: 60, height: 60 },
  { id: 'large', label: 'Large (75x75)', width: 75, height: 75 },
  { id: 'huge', label: 'Huge (100x100)', width: 100, height: 100 },
];
const DEFAULT_MAP_SIZE: MapSizeOption = MAP_SIZE_OPTIONS[1] ?? {
  id: 'small',
  label: 'Small (50x50)',
  width: 50,
  height: 50,
};

const DEFAULT_MAP_SHAPE: Pick<MapGenerationRequest, 'layout' | 'tileSize' | 'origin'> = {
  layout: 'pointy',
  tileSize: 24,
  origin: { x: 80, y: 80 },
};

const mapStore = useCurrentGameMapStore();
const router = useRouter();

const availableGeneratorIds = listMapGenerators();
const selectedGeneratorId = ref<string>(availableGeneratorIds[0] ?? '');
const selectedMapSizeId = ref<string>(DEFAULT_MAP_SIZE.id);
const generatorParams = ref<GeneratorParams>({});
const isStarting = ref(false);
const startError = ref('');

const formatGeneratorId = (value: string) =>
  value.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const generatorOptions = computed<GeneratorOption[]>(() =>
  availableGeneratorIds.map((id) => {
    const definition = getMapGenerator(id);

    return {
      id,
      label: definition?.displayName ?? formatGeneratorId(id),
      description: definition?.description ?? 'Custom map generator.',
    };
  }),
);

const selectedGeneratorDefinition = computed(() => getMapGenerator(selectedGeneratorId.value));
const selectedParameterDefinitions = computed<MapGeneratorNumericParameterDefinition[]>(
  () => selectedGeneratorDefinition.value?.parameterDefinitions ?? [],
);
const selectedGeneratorDescription = computed(
  () => selectedGeneratorDefinition.value?.description ?? 'Custom map generator.',
);
const selectedMapSize = computed<MapSizeOption>(
  () => MAP_SIZE_OPTIONS.find((size) => size.id === selectedMapSizeId.value) ?? DEFAULT_MAP_SIZE,
);

const toDefaultParams = (
  definitions: MapGeneratorNumericParameterDefinition[],
): GeneratorParams => {
  const params: GeneratorParams = {};

  for (const definition of definitions) {
    params[definition.key] = definition.defaultValue;
  }

  return params;
};

watch(
  selectedParameterDefinitions,
  (definitions) => {
    generatorParams.value = toDefaultParams(definitions);
  },
  { immediate: true },
);

const updateParameterValue = (parameterKey: string, value: number) => {
  generatorParams.value[parameterKey] = value;
};

const normalizeParameterValue = (
  definition: MapGeneratorNumericParameterDefinition,
  value: number | undefined,
) => {
  let normalizedValue = Number.isFinite(value) ? (value as number) : definition.defaultValue;

  if (typeof definition.min === 'number') {
    normalizedValue = Math.max(definition.min, normalizedValue);
  }

  if (typeof definition.max === 'number') {
    normalizedValue = Math.min(definition.max, normalizedValue);
  }

  if (definition.integer) {
    normalizedValue = Math.round(normalizedValue);
  }

  return normalizedValue;
};

const buildGeneratorParams = (definitions: MapGeneratorNumericParameterDefinition[]) => {
  const params: GeneratorParams = {};

  for (const definition of definitions) {
    params[definition.key] = normalizeParameterValue(
      definition,
      generatorParams.value[definition.key],
    );
  }

  return params;
};

const startGame = async () => {
  startError.value = '';

  if (!availableGeneratorIds.length) {
    startError.value = 'No map generators are currently available.';
    return;
  }

  const selectedDefinition = selectedGeneratorDefinition.value;

  if (!selectedDefinition) {
    startError.value = 'Selected map generator is not registered.';
    return;
  }

  if (!availableGeneratorIds.includes(selectedGeneratorId.value)) {
    startError.value = 'Please choose a valid map generator.';
    return;
  }

  isStarting.value = true;

  try {
    const timestamp = Date.now();
    const parameterDefinitions = selectedDefinition.parameterDefinitions ?? [];
    const request: MapGenerationRequest = {
      algorithmId: selectedGeneratorId.value,
      width: selectedMapSize.value.width,
      height: selectedMapSize.value.height,
      ...DEFAULT_MAP_SHAPE,
      seedHash: `${selectedGeneratorId.value}-${timestamp}`,
      mapId: `game-${timestamp}`,
      params: buildGeneratorParams(parameterDefinitions),
    };

    mapStore.generateMap(request);
    await router.push({
      name: 'game',
      params: {
        gameId: request.mapId ?? '1',
      },
    });
  } catch (error) {
    startError.value =
      error instanceof Error ? error.message : 'Failed to create game with selected generator.';
  } finally {
    isStarting.value = false;
  }
};

const backToMenu = () => {
  router.push('/home');
};
</script>

<template>
  <div class="page create-game-page">
    <div class="create-aura create-aura-left" aria-hidden="true"></div>
    <div class="create-aura create-aura-right" aria-hidden="true"></div>

    <GPanel class="create-game-panel">
      <div class="create-content">
        <p class="create-kicker">New Session Setup</p>
        <h1 class="create-title">Create Game</h1>
        <p class="create-subtitle">Choose a map generator and tune its parameters.</p>

        <div class="form-stack">
          <div class="input-field">
            <label class="field-label" for="generator-select">Map Generator</label>
            <GSelect
              id="generator-select"
              v-model="selectedGeneratorId"
              :disabled="!generatorOptions.length"
            >
              <option v-for="option in generatorOptions" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </GSelect>
            <p class="field-help">{{ selectedGeneratorDescription }}</p>
          </div>

          <div class="input-field">
            <label class="field-label" for="map-size-select">Map Size</label>
            <GSelect id="map-size-select" v-model="selectedMapSizeId">
              <option v-for="option in MAP_SIZE_OPTIONS" :key="option.id" :value="option.id">
                {{ option.label }}
              </option>
            </GSelect>
            <p class="field-help">
              Selected: {{ selectedMapSize.width }}x{{ selectedMapSize.height }}
            </p>
          </div>

          <div v-if="selectedParameterDefinitions.length" class="parameter-grid">
            <div
              v-for="definition in selectedParameterDefinitions"
              :key="definition.key"
              class="input-field"
            >
              <label class="field-label" :for="`param-${definition.key}`">
                {{ definition.label }}
              </label>
              <GNumberInput
                :id="`param-${definition.key}`"
                :model-value="generatorParams[definition.key] ?? definition.defaultValue"
                :min="definition.min"
                :max="definition.max"
                :step="definition.step ?? 1"
                @update:model-value="(value) => updateParameterValue(definition.key, value)"
              />
              <p v-if="definition.description" class="field-help">{{ definition.description }}</p>
            </div>
          </div>

          <p v-else class="field-help">
            This map generator does not expose customizable numeric parameters.
          </p>
        </div>

        <p v-if="startError" class="error-message">{{ startError }}</p>

        <div class="action-row">
          <GButton class="action-button action-secondary" @click="backToMenu">Back</GButton>
          <GButton class="action-button action-primary" :disabled="isStarting" @click="startGame">
            {{ isStarting ? 'Generating...' : 'Start Game' }}
          </GButton>
        </div>
      </div>
    </GPanel>
  </div>
</template>

<style scoped>
.create-game-page {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: clamp(1rem, 3vw, 2rem);
  overflow: clip;
  isolation: isolate;
  background:
    radial-gradient(circle at 12% 14%, rgba(169, 124, 71, 0.2), transparent 45%),
    radial-gradient(circle at 84% 14%, rgba(42, 92, 132, 0.32), transparent 40%),
    radial-gradient(circle at 50% 100%, rgba(16, 33, 45, 0.88), rgba(7, 12, 18, 1) 68%);
}

.create-aura {
  position: absolute;
  width: clamp(11rem, 30vw, 23rem);
  aspect-ratio: 1;
  border-radius: 50%;
  filter: blur(44px);
  opacity: 0.45;
  z-index: -1;
}

.create-aura-left {
  left: -7rem;
  top: -6rem;
  background: rgba(169, 124, 71, 0.72);
}

.create-aura-right {
  right: -6rem;
  bottom: -6rem;
  background: rgba(42, 92, 132, 0.8);
}

.create-game-panel {
  width: min(72rem, 100%);
  max-width: 100%;
  animation: create-panel-enter 580ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

.create-content {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  text-align: center;
}

.create-kicker {
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(225, 229, 237, 0.88);
}

.create-title {
  margin: 0;
  font-size: clamp(2rem, 7vw, 3.4rem);
  line-height: 0.96;
  letter-spacing: 0.03em;
  color: #f3e8d0;
  font-family: 'Cinzel', 'Book Antiqua', Palatino, serif;
}

.create-subtitle {
  margin: 0 auto 0.45rem;
  max-width: 34ch;
  color: rgba(214, 220, 232, 0.9);
}

.form-stack {
  display: grid;
  gap: 0.75rem;
}

.parameter-grid {
  display: grid;
  gap: 0.65rem;
}

.input-field {
  display: grid;
  gap: 0.36rem;
  text-align: left;
}

.field-label {
  margin: 0;
  color: #f5f7fb;
  font-size: 0.92rem;
  letter-spacing: 0.02em;
  font-weight: 700;
}

.field-help {
  margin: 0;
  color: rgba(214, 220, 232, 0.84);
  font-size: 0.92rem;
}

.error-message {
  margin: 0.2rem 0 0;
  font-size: 0.92rem;
  color: #ffd3c7;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  margin-top: 0.2rem;
}

.action-button {
  width: 100%;
}

.action-primary {
  font-weight: 700;
}

@keyframes create-panel-enter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .create-content {
    width: 100%;
  }

  .action-row {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .create-game-panel {
    animation: none;
  }
}
</style>
