import type { TileType } from '~/base/tiles';
import type { MapTile } from '~/types/map';

import { isLandAt, type MapGrid } from '~/game/mapgen/pipeline/grid';

const WATER_TERRAINS = new Set<TileType>(['ocean', 'deep_sea', 'coastal_sea']);

export type MapQualityMetrics = {
  landRatio: number;
  landTileCount: number;
  waterTileCount: number;
  landmassCount: number;
  largestLandmassShare: number;
  coastlineComplexity: number;
  directionalityScore: number;
  dominantAxis: 0 | 1 | 2;
};

export const buildLandMaskFromTiles = (grid: MapGrid, tiles: readonly MapTile[]): Uint8Array => {
  const terrainByKey = new Map<string, TileType>();

  for (const tile of tiles) {
    terrainByKey.set(`${tile.q},${tile.r}`, tile.terrain);
  }

  return Uint8Array.from(
    grid.tiles.map((tile) => {
      const terrain = terrainByKey.get(tile.key);
      return terrain && !WATER_TERRAINS.has(terrain) ? 1 : 0;
    }),
  );
};

const computeLandmassStats = (grid: MapGrid, landMask: ArrayLike<number>) => {
  const visited = new Uint8Array(grid.tiles.length);
  let landmassCount = 0;
  let largestLandmass = 0;

  for (let startIndex = 0; startIndex < grid.tiles.length; startIndex += 1) {
    if (!isLandAt(landMask, startIndex) || (visited[startIndex] ?? 0) > 0) {
      continue;
    }

    landmassCount += 1;
    let componentSize = 0;
    const queue = [startIndex];
    visited[startIndex] = 1;

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const tileIndex = queue[queueIndex];

      if (typeof tileIndex !== 'number') {
        continue;
      }

      componentSize += 1;
      const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

      for (const neighborIndex of neighbors) {
        if (
          typeof neighborIndex !== 'number' ||
          neighborIndex < 0 ||
          (visited[neighborIndex] ?? 0) > 0 ||
          !isLandAt(landMask, neighborIndex)
        ) {
          continue;
        }

        visited[neighborIndex] = 1;
        queue.push(neighborIndex);
      }
    }

    largestLandmass = Math.max(largestLandmass, componentSize);
  }

  return {
    landmassCount,
    largestLandmass,
  };
};

const computeCoastlineAndDirectionality = (grid: MapGrid, landMask: ArrayLike<number>) => {
  let coastlineEdges = 0;
  const axisCounts = [0, 0, 0];

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    const tileIsLand = isLandAt(landMask, tileIndex);
    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

    for (let direction = 0; direction < neighbors.length; direction += 1) {
      const neighborIndex = neighbors[direction];

      if (typeof neighborIndex !== 'number' || neighborIndex < 0 || neighborIndex <= tileIndex) {
        continue;
      }

      const neighborIsLand = isLandAt(landMask, neighborIndex);

      if (tileIsLand === neighborIsLand) {
        continue;
      }

      coastlineEdges += 1;
      const axis = direction % 3;
      axisCounts[axis] = (axisCounts[axis] ?? 0) + 1;
    }
  }

  if (!coastlineEdges) {
    return {
      coastlineEdges,
      dominantAxis: 0 as const,
      directionalityScore: 0,
    };
  }

  const axisCountAt = (axis: number): number => axisCounts[axis] ?? 0;
  const dominantAxisIndex = axisCounts.reduce((bestAxis, _, axis) => {
    return axisCountAt(axis) > axisCountAt(bestAxis) ? axis : bestAxis;
  }, 0) as 0 | 1 | 2;
  const dominantShare = (axisCounts[dominantAxisIndex] ?? 0) / coastlineEdges;

  return {
    coastlineEdges,
    dominantAxis: dominantAxisIndex,
    directionalityScore: Math.max(0, dominantShare - 1 / 3),
  };
};

export const calculateMapQualityMetrics = (
  grid: MapGrid,
  landMask: ArrayLike<number>,
): MapQualityMetrics => {
  const landTileCount = grid.tiles.reduce(
    (count, _, index) => (isLandAt(landMask, index) ? count + 1 : count),
    0,
  );
  const waterTileCount = grid.tiles.length - landTileCount;
  const landRatio = grid.tiles.length > 0 ? landTileCount / grid.tiles.length : 0;
  const { landmassCount, largestLandmass } = computeLandmassStats(grid, landMask);
  const { coastlineEdges, dominantAxis, directionalityScore } = computeCoastlineAndDirectionality(
    grid,
    landMask,
  );

  return {
    landRatio,
    landTileCount,
    waterTileCount,
    landmassCount,
    largestLandmassShare: landTileCount > 0 ? largestLandmass / landTileCount : 0,
    coastlineComplexity: landTileCount > 0 ? coastlineEdges / landTileCount : 0,
    directionalityScore,
    dominantAxis,
  };
};

export type AggregatedMetricSummary = {
  average: number;
  minimum: number;
  maximum: number;
};

export type AggregatedMapQualityMetrics = {
  landRatio: AggregatedMetricSummary;
  landmassCount: AggregatedMetricSummary;
  largestLandmassShare: AggregatedMetricSummary;
  coastlineComplexity: AggregatedMetricSummary;
  directionalityScore: AggregatedMetricSummary;
};

const summarize = (values: readonly number[]): AggregatedMetricSummary => {
  if (!values.length) {
    return {
      average: 0,
      minimum: 0,
      maximum: 0,
    };
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    average,
    minimum,
    maximum,
  };
};

export const aggregateMapQualityMetrics = (
  samples: readonly MapQualityMetrics[],
): AggregatedMapQualityMetrics => {
  return {
    landRatio: summarize(samples.map((sample) => sample.landRatio)),
    landmassCount: summarize(samples.map((sample) => sample.landmassCount)),
    largestLandmassShare: summarize(samples.map((sample) => sample.largestLandmassShare)),
    coastlineComplexity: summarize(samples.map((sample) => sample.coastlineComplexity)),
    directionalityScore: summarize(samples.map((sample) => sample.directionalityScore)),
  };
};
