import { ref } from 'vue';
import { defineStore } from 'pinia';

import type { TileType } from '../../base/tiles';
import type { GameMap, MapTile } from '../../types/map';
import { toHexKey } from '../../types/hex';

const createTile = (q: number, r: number, terrain: TileType): MapTile => ({
  q,
  r,
  terrain,
});

const createDebugMap = (): GameMap => {
  const seedTiles: MapTile[] = [
    createTile(0, 0, 'grass'),
    createTile(1, 0, 'plains'),
    createTile(2, 0, 'hill'),
    createTile(0, 1, 'grass'),
    createTile(1, 1, 'water'),
    createTile(2, 1, 'plains'),
    createTile(-1, 2, 'water'),
    createTile(0, 2, 'grass'),
    createTile(1, 2, 'hill'),
  ];

  const tilesByKey = seedTiles.reduce<GameMap['tilesByKey']>((acc, tile) => {
    acc[toHexKey(tile.q, tile.r)] = tile;
    return acc;
  }, {});

  const tileKeys = seedTiles.map((tile) => toHexKey(tile.q, tile.r));

  return {
    id: 'debug-map-001',
    layout: 'pointy',
    tileSize: 42,
    origin: { x: 180, y: 140 },
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
