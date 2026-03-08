import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { TileType } from '~/base/tiles';
import type { GameMap, MapTile } from '~/types/map';
import { toHexKey } from '~/types/hex';

const MAP_WIDTH = 30;
const MAP_HEIGHT = 30;

const createTile = (q: number, r: number, terrain: TileType): MapTile => ({
  q,
  r,
  terrain,
});

const getTerrainFor = (q: number, r: number): TileType => {
  const rawValue = q * 17 + r * 31;
  const value = ((rawValue % 12) + 12) % 12;

  if (value <= 1) {
    return 'water';
  }

  if (value <= 4) {
    return 'hill';
  }

  if (value <= 8) {
    return 'plains';
  }

  return 'grass';
};

const createDebugMap = (): GameMap => {
  const seedTiles: MapTile[] = [];

  for (let r = 0; r < MAP_HEIGHT; r += 1) {
    for (let col = 0; col < MAP_WIDTH; col += 1) {
      const q = col - Math.floor(r / 2);
      seedTiles.push(createTile(q, r, getTerrainFor(q, r)));
    }
  }

  const tilesByKey = seedTiles.reduce<GameMap['tilesByKey']>((acc, tile) => {
    acc[toHexKey(tile.q, tile.r)] = tile;
    return acc;
  }, {});

  const tileKeys = seedTiles.map((tile) => toHexKey(tile.q, tile.r));

  return {
    id: 'debug-map-001',
    layout: 'pointy',
    tileSize: 24,
    origin: { x: 80, y: 80 },
    tilesByKey,
    tileKeys,
  };
};

export const useCurrentGameMapStore = defineStore('currentGameMap', () => {
  const currentMap = ref<GameMap>(createDebugMap());

  const setMap = (nextMap: GameMap) => {
    currentMap.value = nextMap;
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
    setMap,
    setTileTerrain,
  };
});
