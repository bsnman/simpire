import type { ElevationType } from '~/base/elevation';
import type { TileType } from '~/base/tiles';
import { clamp } from '~/game/mapgen/helpers';
import type { MapTile } from '~/types/map';

import { isLandAt, type GridTile, type MapGrid } from '~/game/mapgen/pipeline/grid';

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

const classifyLandElevation = (
  elevation: number,
  distanceToWater: number,
  mountainIntensity: number,
  detailNoise: number,
): ElevationType => {
  const inlandBoost = Math.min(4, Math.max(0, distanceToWater)) * 0.01;
  const normalized = clamp(elevation + inlandBoost + (detailNoise - 0.5) * 0.05, 0, 1);
  const mountainThreshold = 0.82 - mountainIntensity * 0.22;
  const hillThreshold = mountainThreshold - 0.13;

  if (normalized >= mountainThreshold) {
    return 'mountain';
  }

  if (normalized >= hillThreshold) {
    return 'hill';
  }

  return 'flat';
};

const normalizeClimateBlend = (value: number): number => clamp((value - 0.5) * 1.18 + 0.5, 0, 1);

const sampleClimateNoise = (
  tile: GridTile,
  noiseAt: (q: number, r: number, salt?: string) => number,
  salt: string,
): number => {
  const base = noiseAt(tile.q, tile.r, `${salt}-base`);
  const axisA = noiseAt(tile.q + tile.r, -tile.q, `${salt}-axis-a`);
  const axisB = noiseAt(-tile.r, tile.q + tile.r, `${salt}-axis-b`);
  const micro = noiseAt(tile.q * 2 - tile.r, tile.r * 2 + tile.q, `${salt}-micro`);

  return normalizeClimateBlend(base * 0.38 + axisA * 0.24 + axisB * 0.24 + micro * 0.14);
};

const classifyLandTerrain = (
  tile: GridTile,
  gridHeight: number,
  elevation: ElevationType,
  distanceToWater: number,
  noiseAt: (q: number, r: number, salt?: string) => number,
): TileType => {
  const normalizedRow = gridHeight > 1 ? tile.row / (gridHeight - 1) : 0.5;
  const latitude = Math.abs(normalizedRow - 0.5) * 2;
  const heatNoise = sampleClimateNoise(tile, noiseAt, 'terrain-heat');
  const moistureNoise = sampleClimateNoise(tile, noiseAt, 'terrain-moisture');
  const fertilityNoise = sampleClimateNoise(tile, noiseAt, 'terrain-fertility');
  const coastalMoisture = Math.max(0, 2 - Math.max(0, distanceToWater)) * 0.1;
  const elevationColdPenalty = elevation === 'mountain' ? 0.08 : elevation === 'hill' ? 0.03 : 0;
  const aridity = clamp(
    0.48 + heatNoise * 0.35 + latitude * 0.32 - moistureNoise * 0.42 - coastalMoisture,
    0,
    1,
  );
  const coldness = clamp(latitude * 0.76 + (1 - heatNoise) * 0.34 + elevationColdPenalty, 0, 1);

  if (coldness >= 0.82) {
    return 'tundra';
  }

  if (aridity >= 0.7) {
    return 'desert';
  }

  const fertility = clamp(
    fertilityNoise + moistureNoise * 0.2 - latitude * 0.12 + coastalMoisture,
    0,
    1,
  );

  return fertility >= 0.52 ? 'grassland' : 'plains';
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
        elevation: 'underwater',
      };
    }

    const landElevation = classifyLandElevation(
      elevation[tileIndex] ?? 0,
      distanceToWater[tileIndex] ?? 0,
      mountainIntensity,
      config.noiseAt(tile.q, tile.r, 'terrain-detail'),
    );

    return {
      q: tile.q,
      r: tile.r,
      terrain: classifyLandTerrain(
        tile,
        grid.height,
        landElevation,
        distanceToWater[tileIndex] ?? 0,
        config.noiseAt,
      ),
      elevation: landElevation,
    };
  });

  return {
    tiles,
    distanceToLand,
    distanceToWater,
  };
};
