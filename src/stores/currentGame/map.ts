import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { TileType } from '~/base/tiles';
import type { GameMap } from '~/types/map';
import { toHexKey } from '~/types/hex';
import {
  CONTINENTS_GENERATOR_ID,
  type ContinentsParams,
  generateMap as generateMapByAlgorithm,
  type MapGenerationRequest,
} from '~/game/mapgen';

const DEFAULT_MAP_REQUEST: MapGenerationRequest = {
  algorithmId: CONTINENTS_GENERATOR_ID,
  width: 30,
  height: 30,
  seedHash: 'debug-map-001',
  params: {
    seaLevelPercent: 70,
    continentCount: 2,
  } satisfies ContinentsParams,
  mapId: 'debug-map-001',
  layout: 'pointy',
  tileSize: 24,
  origin: { x: 80, y: 80 },
};

export const useCurrentGameMapStore = defineStore('currentGameMap', () => {
  const lastGenerationRequest = ref<MapGenerationRequest>(DEFAULT_MAP_REQUEST);
  const currentMap = ref<GameMap>(generateMapByAlgorithm(DEFAULT_MAP_REQUEST));

  const setMap = (nextMap: GameMap) => {
    currentMap.value = nextMap;
  };

  const generateMap = (request: MapGenerationRequest) => {
    currentMap.value = generateMapByAlgorithm(request);
    lastGenerationRequest.value = request;
  };

  const regenerateMap = (seedHash?: string) => {
    const request = {
      ...lastGenerationRequest.value,
      seedHash: seedHash ?? lastGenerationRequest.value.seedHash,
    };

    currentMap.value = generateMapByAlgorithm(request);
    lastGenerationRequest.value = request;
  };

  const setTileTerrain = (q: number, r: number, terrain: TileType) => {
    const key = toHexKey(q, r);
    const existing = currentMap.value.tilesByKey[key];

    if (!existing) {
      return;
    }

    currentMap.value.tilesByKey[key] = {
      ...existing,
      terrain,
    };
  };

  return {
    currentMap,
    lastGenerationRequest,
    setMap,
    generateMap,
    regenerateMap,
    setTileTerrain,
  };
});
