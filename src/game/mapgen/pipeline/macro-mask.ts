import { clamp } from '~/game/mapgen/helpers';
import type { SeededRandom } from '~/game/mapgen/random';
import {
  buildDeterministicShuffle,
  countLandNeighbors,
  isLandAt,
  type MapGrid,
} from '~/game/mapgen/pipeline/grid';
import type { VoronoiResult } from '~/game/mapgen/pipeline/voronoi';

export type MacroMaskConfig = {
  landRatio: number;
  primaryRegionTarget: number;
  largeMassBias: number;
  fragmentation: number;
  chainTendency: number;
  edgeOceanBias: number;
  random: SeededRandom;
  noiseAt: (q: number, r: number, salt?: string) => number;
};

export type RebalanceLandMaskOptions = {
  grid: MapGrid;
  landMask: Uint8Array;
  targetLandRatio: number;
  noiseAt: (q: number, r: number, salt?: string) => number;
  regionScoreByTile?: ArrayLike<number>;
};

export type MacroMaskResult = {
  landMask: Uint8Array;
  regionScores: number[];
  regionScoreByTile: Float64Array;
  targetLandTiles: number;
  landTileCount: number;
};

const countLandTiles = (landMask: ArrayLike<number>): number => {
  let count = 0;

  for (let index = 0; index < landMask.length; index += 1) {
    if (isLandAt(landMask, index)) {
      count += 1;
    }
  }

  return count;
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
  config: Pick<MacroMaskConfig, 'largeMassBias' | 'edgeOceanBias' | 'noiseAt'>,
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

export const rebalanceLandMaskToTarget = ({
  grid,
  landMask,
  targetLandRatio,
  noiseAt,
  regionScoreByTile,
}: RebalanceLandMaskOptions): Uint8Array => {
  const targetTiles = Math.max(
    0,
    Math.min(grid.tiles.length, Math.round(grid.tiles.length * clamp(targetLandRatio, 0, 1))),
  );
  let currentLandTiles = countLandTiles(landMask);

  if (currentLandTiles === targetTiles || !grid.tiles.length) {
    return landMask;
  }

  const candidates: { index: number; score: number }[] = [];

  if (currentLandTiles < targetTiles) {
    const neededTiles = targetTiles - currentLandTiles;

    for (let index = 0; index < grid.tiles.length; index += 1) {
      if (isLandAt(landMask, index)) {
        continue;
      }

      const tile = grid.tiles[index];

      if (!tile) {
        continue;
      }

      const edgePenalty = 1 - edgeRatioForTile(grid, index);
      const neighborLandRatio =
        countLandNeighbors(grid.neighborsByIndex[index] ?? [], landMask) / 6;
      const regionScore = regionScoreByTile?.[index] ?? 0.5;
      const noise = noiseAt(tile.q, tile.r, 'rebalance-grow');
      const score =
        regionScore * 0.56 + neighborLandRatio * 0.34 + (0.5 - noise) * 0.1 - edgePenalty * 0.22;

      candidates.push({ index, score });
    }

    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

    for (let offset = 0; offset < neededTiles; offset += 1) {
      const candidate = candidates[offset];

      if (!candidate) {
        break;
      }

      landMask[candidate.index] = 1;
      currentLandTiles += 1;
    }

    return landMask;
  }

  const removeTiles = currentLandTiles - targetTiles;

  for (let index = 0; index < grid.tiles.length; index += 1) {
    if (!isLandAt(landMask, index)) {
      continue;
    }

    const tile = grid.tiles[index];

    if (!tile) {
      continue;
    }

    const edgePenalty = 1 - edgeRatioForTile(grid, index);
    const neighborLandRatio = countLandNeighbors(grid.neighborsByIndex[index] ?? [], landMask) / 6;
    const regionScore = regionScoreByTile?.[index] ?? 0.5;
    const noise = noiseAt(tile.q, tile.r, 'rebalance-shrink');
    const score =
      (1 - regionScore) * 0.5 + (1 - neighborLandRatio) * 0.35 + edgePenalty * 0.25 + noise * 0.12;

    candidates.push({ index, score });
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.index - right.index;
  });

  for (let offset = 0; offset < removeTiles; offset += 1) {
    const candidate = candidates[offset];

    if (!candidate) {
      break;
    }

    landMask[candidate.index] = 0;
  }

  return landMask;
};

export const buildMacroMask = (
  grid: MapGrid,
  voronoi: VoronoiResult,
  config: MacroMaskConfig,
): MacroMaskResult => {
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

    if (
      !mustTakeRegion &&
      projectedLandCount > targetLandTiles * primaryRegionOvershootTolerance
    ) {
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
