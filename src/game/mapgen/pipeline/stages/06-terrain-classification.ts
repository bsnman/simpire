import type { ElevationType } from '/base/elevation';
import type { TileType } from '/base/tiles';
import { clamp } from '/game/mapgen/helpers';
import type {
  MapgenPipelineStage,
  MapgenPipelineState,
  TerrainClassificationState,
} from '/game/mapgen/pipeline/contracts';
import { isLandAt, type GridTile, type MapGrid } from '/game/mapgen/pipeline/support/grid';
import { sampleIsotropicField } from '/game/mapgen/pipeline/support/isotropic-noise';
import type { MapTile } from '/types/map';

export type TerrainClassificationConfig = {
  shelfWidth: number;
  mountainIntensity: number;
  noiseAt: (q: number, r: number, salt?: string) => number;
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
  reliefNoise: number,
): ElevationType => {
  const inlandBoost = Math.min(4, Math.max(0, distanceToWater)) * 0.01;
  const normalized = clamp(elevation + inlandBoost + (detailNoise - 0.5) * 0.08, 0, 1);
  const thresholdShift = (reliefNoise - 0.5) * 0.08;
  const mountainThreshold = 0.82 - mountainIntensity * 0.2 + thresholdShift * 0.45;
  const hillThreshold = mountainThreshold - 0.15 + thresholdShift * 0.75;

  if (normalized >= mountainThreshold) {
    return 'mountain';
  }

  if (normalized >= hillThreshold) {
    return 'hill';
  }

  return 'flat';
};

const sampleClimateNoise = (
  tile: GridTile,
  noiseAt: (q: number, r: number, salt?: string) => number,
  salt: string,
): number => {
  return sampleIsotropicField(tile.q, tile.r, noiseAt, salt);
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
): TerrainClassificationState => {
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
      sampleIsotropicField(tile.q, tile.r, config.noiseAt, 'terrain-detail', {
        contrast: 1.12,
        frequency: 0.34,
        warpAmount: 0.45,
      }),
      sampleIsotropicField(tile.q, tile.r, config.noiseAt, 'terrain-relief', {
        contrast: 1.08,
        frequency: 0.42,
        warpAmount: 0.5,
      }),
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

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<Pick<MapgenPipelineState, 'grid' | 'detailPass' | 'subseeds'>> => {
  if (!state.grid || !state.detailPass || !state.subseeds) {
    throw new Error('Terrain classification stage requires detail pass output.');
  }

  return state as MapgenPipelineState &
    Required<Pick<MapgenPipelineState, 'grid' | 'detailPass' | 'subseeds'>>;
};

export const terrainClassificationStage: MapgenPipelineStage = {
  id: '06-terrain-classification',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      terrainClassification: classifyTerrain(
        nextState.grid,
        nextState.detailPass.landMask,
        nextState.detailPass.elevation,
        {
          shelfWidth: nextState.profile.shelfWidth,
          mountainIntensity: nextState.profile.mountainIntensity,
          noiseAt: (q, r, salt) => nextState.subseeds.noiseAt('climate', q, r, salt),
        },
      ),
    };
  },
};
