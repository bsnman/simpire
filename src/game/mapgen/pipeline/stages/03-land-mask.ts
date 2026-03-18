import { clamp } from '/game/mapgen/helpers';
import type {
  MacroLandMaskState,
  MapgenPipelineStage,
  MapgenPipelineState,
} from '/game/mapgen/pipeline/contracts';
import {
  buildDeterministicShuffle,
  countLandNeighbors,
  isLandAt,
  type MapGrid,
} from '/game/mapgen/pipeline/support/grid';
import { countLandTiles, rebalanceLandMaskToTarget } from '/game/mapgen/pipeline/support/land-mask';
import type { VoronoiResult } from '/game/mapgen/pipeline/support/voronoi';
import type { SeededRandom } from '/game/mapgen/random';

export type MacroLandMaskConfig = {
  landRatio: number;
  primaryRegionTarget: number;
  largeMassBias: number;
  fragmentation: number;
  chainTendency: number;
  edgeOceanBias: number;
  random: SeededRandom;
  noiseAt: (q: number, r: number, salt?: string) => number;
};

const edgeRatioForTile = (grid: MapGrid, tileIndex: number): number => {
  const tile = grid.tiles[tileIndex];

  if (!tile) {
    return 0;
  }

  const toLeftEdge = tile.col;
  const toRightEdge = grid.width - 1 - tile.col;
  const toTopEdge = tile.row;
  const toBottomEdge = grid.height - 1 - tile.row;
  const minDistanceToEdge = Math.min(toLeftEdge, toRightEdge, toTopEdge, toBottomEdge);
  const normalizer = Math.max(1, (Math.min(grid.width, grid.height) - 1) / 2);

  return clamp(minDistanceToEdge / normalizer, 0, 1);
};

const regionScoreAt = (
  regionIndex: number,
  voronoi: VoronoiResult,
  grid: MapGrid,
  config: Pick<MacroLandMaskConfig, 'largeMassBias' | 'edgeOceanBias' | 'noiseAt'>,
  maxRegionSize: number,
): number => {
  const region = voronoi.regions[regionIndex];

  if (!region || !region.tileIndices.length) {
    return 0;
  }

  const sizeRatio = region.tileIndices.length / Math.max(1, maxRegionSize);
  const approxQ = Math.round(region.centroidCol - Math.floor(region.centroidRow / 2));
  const approxR = Math.round(region.centroidRow);
  const noise = config.noiseAt(approxQ, approxR, 'region-score');

  const centerCol = (grid.width - 1) / 2;
  const centerRow = (grid.height - 1) / 2;
  const distanceX = (region.centroidCol - centerCol) / Math.max(1, centerCol);
  const distanceY = (region.centroidRow - centerRow) / Math.max(1, centerRow);
  const edgePenalty = clamp(Math.sqrt(distanceX * distanceX + distanceY * distanceY), 0, 1);

  return (
    sizeRatio * config.largeMassBias +
    noise * (1 - config.largeMassBias) -
    edgePenalty * config.edgeOceanBias * 0.7
  );
};

const sortIndicesByScoreDescending = (scores: readonly number[]): number[] =>
  scores
    .map((score, index) => ({ score, index }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.index);

export const buildMacroLandMask = (
  grid: MapGrid,
  voronoi: VoronoiResult,
  config: MacroLandMaskConfig,
): MacroLandMaskState => {
  if (!grid.tiles.length) {
    return {
      landMask: new Uint8Array(),
      regionScores: [],
      regionScoreByTile: new Float64Array(),
      targetLandTiles: 0,
      landTileCount: 0,
    };
  }

  const clampedLandRatio = clamp(config.landRatio, 0, 1);
  const primaryRegionTarget = Math.max(
    1,
    Math.min(voronoi.regions.length, Math.round(config.primaryRegionTarget)),
  );
  const targetLandTiles = Math.round(grid.tiles.length * clampedLandRatio);
  const maxRegionSize = voronoi.regions.reduce(
    (currentMax, region) => Math.max(currentMax, region.tileIndices.length),
    1,
  );

  const regionScores = voronoi.regions.map((_, regionIndex) =>
    regionScoreAt(regionIndex, voronoi, grid, config, maxRegionSize),
  );
  const sortedRegionIds = sortIndicesByScoreDescending(regionScores);
  const landMask = new Uint8Array(grid.tiles.length);

  let landTileCount = 0;
  let chosenRegions = 0;

  const addRegionToLandMask = (regionId: number): boolean => {
    const region = voronoi.regions[regionId];

    if (!region) {
      return false;
    }

    let addedAny = false;

    for (const tileIndex of region.tileIndices) {
      const currentValue = landMask[tileIndex] ?? 0;

      if (currentValue > 0) {
        continue;
      }

      landMask[tileIndex] = 1;
      landTileCount += 1;
      addedAny = true;
    }

    return addedAny;
  };

  const primaryRegionMinCount = Math.max(
    1,
    Math.min(
      primaryRegionTarget,
      Math.floor(primaryRegionTarget * (0.35 + clamp(config.chainTendency, 0, 1) * 0.1)),
    ),
  );
  const primaryRegionOvershootTolerance = clamp(
    1.04 +
      (1 - clamp(config.fragmentation, 0, 1)) * 0.08 +
      clamp(config.largeMassBias, 0, 1) * 0.05,
    1.04,
    1.2,
  );

  for (const regionId of sortedRegionIds) {
    if (chosenRegions >= primaryRegionTarget) {
      break;
    }

    const region = voronoi.regions[regionId];

    if (!region) {
      continue;
    }

    const mustTakeRegion = chosenRegions < primaryRegionMinCount;
    const projectedLandCount = landTileCount + region.tileIndices.length;

    if (!mustTakeRegion && projectedLandCount > targetLandTiles * primaryRegionOvershootTolerance) {
      continue;
    }

    if (addRegionToLandMask(regionId)) {
      chosenRegions += 1;
    }
  }

  if (chosenRegions < primaryRegionMinCount) {
    for (const regionId of sortedRegionIds) {
      if (chosenRegions >= primaryRegionMinCount) {
        break;
      }

      if (addRegionToLandMask(regionId)) {
        chosenRegions += 1;
      }
    }
  }

  let regionOffset = 0;

  while (landTileCount < targetLandTiles * 0.9 && regionOffset < sortedRegionIds.length) {
    const regionId = sortedRegionIds[regionOffset];
    if (typeof regionId !== 'number') {
      regionOffset += 1;
      continue;
    }

    const region = voronoi.regions[regionId];

    if (!region) {
      regionOffset += 1;
      continue;
    }

    addRegionToLandMask(regionId);

    regionOffset += 1;
  }

  const shuffledIndices = buildDeterministicShuffle(grid.tiles.length, config.random);

  for (const tileIndex of shuffledIndices) {
    const tile = grid.tiles[tileIndex];

    if (!tile) {
      continue;
    }

    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];
    const neighborLandCount = countLandNeighbors(neighbors, landMask);
    const localNoise = config.noiseAt(tile.q, tile.r, 'macro-fragment');
    const edgeRatio = edgeRatioForTile(grid, tileIndex);

    if (isLandAt(landMask, tileIndex)) {
      const erosionThreshold =
        0.95 -
        clamp(config.fragmentation, 0, 1) * 0.6 +
        (neighborLandCount / 6) * 0.2 +
        edgeRatio * clamp(config.edgeOceanBias, 0, 1) * 0.12;

      if (neighborLandCount <= 4 && localNoise > erosionThreshold) {
        landMask[tileIndex] = 0;
      }

      continue;
    }

    const growthThreshold =
      0.08 +
      clamp(config.chainTendency, 0, 1) * 0.48 +
      (neighborLandCount / 6) * 0.26 -
      clamp(config.edgeOceanBias, 0, 1) * (1 - edgeRatio) * 0.16;

    if (neighborLandCount >= 2 && localNoise < growthThreshold) {
      landMask[tileIndex] = 1;
    }
  }

  const regionScoreByTile = new Float64Array(grid.tiles.length);

  for (let index = 0; index < grid.tiles.length; index += 1) {
    const regionId = voronoi.regionByTileIndex[index] ?? 0;
    regionScoreByTile[index] = regionScores[regionId] ?? 0;
  }

  rebalanceLandMaskToTarget({
    grid,
    landMask,
    targetLandRatio: clampedLandRatio,
    noiseAt: config.noiseAt,
    regionScoreByTile,
  });

  return {
    landMask,
    regionScores,
    regionScoreByTile,
    targetLandTiles,
    landTileCount: countLandTiles(landMask),
  };
};

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<
    Pick<
      MapgenPipelineState,
      'grid' | 'voronoi' | 'subseeds' | 'clampedLandRatio' | 'primaryRegionTarget'
    >
  > => {
  if (
    !state.grid ||
    !state.voronoi ||
    !state.subseeds ||
    typeof state.clampedLandRatio !== 'number' ||
    typeof state.primaryRegionTarget !== 'number'
  ) {
    throw new Error('Land mask stage requires bootstrap and macro region outputs.');
  }

  return state as MapgenPipelineState &
    Required<
      Pick<
        MapgenPipelineState,
        'grid' | 'voronoi' | 'subseeds' | 'clampedLandRatio' | 'primaryRegionTarget'
      >
    >;
};

export const landMaskStage: MapgenPipelineStage = {
  id: '03-land-mask',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      macroLandMask: buildMacroLandMask(nextState.grid, nextState.voronoi, {
        landRatio: nextState.clampedLandRatio,
        primaryRegionTarget: nextState.primaryRegionTarget,
        largeMassBias: nextState.profile.largeMassBias,
        fragmentation: nextState.profile.fragmentation,
        chainTendency: nextState.profile.chainTendency,
        edgeOceanBias: nextState.profile.edgeOceanBias,
        random: nextState.subseeds.random('macro'),
        noiseAt: (q, r, salt) => nextState.subseeds.noiseAt('macro', q, r, salt),
      }),
    };
  },
};
