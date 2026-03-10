import type { TileType } from '~/base/tiles';
import { clamp } from '~/game/mapgen/helpers';
import type { MapTile } from '~/types/map';

import { isLandAt, type MapGrid } from '~/game/mapgen/pipeline/grid';

export type TerrainClassificationConfig = {
  shelfWidth: number;
  mountainIntensity: number;
  noiseAt: (q: number, r: number, salt?: string) => number;
};

export type TerrainClassificationResult = {
  tiles: MapTile[];
  distanceToLand: Int32Array;
  distanceToWater: Int32Array;
};

const computeDistanceField = (
  grid: MapGrid,
  isSeed: (tileIndex: number) => boolean,
): Int32Array => {
  const distances = new Int32Array(grid.tiles.length);
  distances.fill(-1);

  const queue: number[] = [];

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    if (!isSeed(tileIndex)) {
      continue;
    }

    distances[tileIndex] = 0;
    queue.push(tileIndex);
  }

  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const tileIndex = queue[queueIndex];
    queueIndex += 1;

    if (typeof tileIndex !== 'number') {
      continue;
    }

    const baseDistance = distances[tileIndex] ?? 0;
    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

    for (const neighborIndex of neighbors) {
      if (
        typeof neighborIndex !== 'number' ||
        neighborIndex < 0 ||
        (distances[neighborIndex] ?? -1) >= 0
      ) {
        continue;
      }

      distances[neighborIndex] = baseDistance + 1;
      queue.push(neighborIndex);
    }
  }

  return distances;
};

const classifyWaterTerrain = (distanceToLand: number, shelfWidth: number): TileType => {
  if (distanceToLand <= shelfWidth) {
    return 'coastal_sea';
  }

  if (distanceToLand <= shelfWidth * 2 + 1) {
    return 'deep_sea';
  }

  return 'ocean';
};

const classifyLandTerrain = (
  elevation: number,
  distanceToWater: number,
  mountainIntensity: number,
  detailNoise: number,
): TileType => {
  const inlandBoost = Math.min(4, Math.max(0, distanceToWater)) * 0.01;
  const normalized = clamp(elevation + inlandBoost + (detailNoise - 0.5) * 0.05, 0, 1);
  const mountainThreshold = 0.82 - mountainIntensity * 0.2;
  const hillThreshold = mountainThreshold - 0.1;
  const plainsThreshold = hillThreshold - 0.04;

  if (normalized >= mountainThreshold) {
    return 'mountain';
  }

  if (normalized >= hillThreshold) {
    return 'hill';
  }

  if (normalized >= plainsThreshold) {
    return 'plains';
  }

  return 'grassland';
};

export const classifyTerrain = (
  grid: MapGrid,
  landMask: ArrayLike<number>,
  elevation: ArrayLike<number>,
  config: TerrainClassificationConfig,
): TerrainClassificationResult => {
  const shelfWidth = Math.max(1, Math.round(config.shelfWidth));
  const mountainIntensity = clamp(config.mountainIntensity, 0, 1);

  const distanceToLand = computeDistanceField(grid, (tileIndex) => isLandAt(landMask, tileIndex));
  const distanceToWater = computeDistanceField(grid, (tileIndex) => !isLandAt(landMask, tileIndex));

  const tiles: MapTile[] = grid.tiles.map((tile, tileIndex) => {
    if (!isLandAt(landMask, tileIndex)) {
      return {
        q: tile.q,
        r: tile.r,
        terrain: classifyWaterTerrain(
          distanceToLand[tileIndex] ?? Number.MAX_SAFE_INTEGER,
          shelfWidth,
        ),
      };
    }

    return {
      q: tile.q,
      r: tile.r,
      terrain: classifyLandTerrain(
        elevation[tileIndex] ?? 0,
        distanceToWater[tileIndex] ?? 0,
        mountainIntensity,
        config.noiseAt(tile.q, tile.r, 'terrain-detail'),
      ),
    };
  });

  return {
    tiles,
    distanceToLand,
    distanceToWater,
  };
};
