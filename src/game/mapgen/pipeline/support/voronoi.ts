import type { MapGrid } from '/game/mapgen/pipeline/support/grid';
import type { PoissonSeedPoint } from '/game/mapgen/pipeline/support/poisson';

export type VoronoiRegion = {
  id: number;
  seed: PoissonSeedPoint;
  tileIndices: number[];
  centroidCol: number;
  centroidRow: number;
  neighborRegionIds: number[];
};

export type VoronoiResult = {
  regionByTileIndex: Int32Array;
  regions: VoronoiRegion[];
};

const squaredDistance = (
  tileCol: number,
  tileRow: number,
  seedCol: number,
  seedRow: number,
): number => {
  const deltaCol = tileCol - seedCol;
  const deltaRow = tileRow - seedRow;
  return deltaCol * deltaCol + deltaRow * deltaRow;
};

export const assignVoronoiRegions = (
  grid: MapGrid,
  seeds: readonly PoissonSeedPoint[],
): VoronoiResult => {
  if (!seeds.length) {
    throw new Error('Voronoi assignment requires at least one seed.');
  }

  const regionByTileIndex = new Int32Array(grid.tiles.length);
  const tileIndicesByRegion = seeds.map(() => [] as number[]);

  for (const tile of grid.tiles) {
    let closestRegion = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const seed of seeds) {
      const distance = squaredDistance(tile.col, tile.row, seed.col, seed.row);

      if (distance < closestDistance || (distance === closestDistance && seed.id < closestRegion)) {
        closestDistance = distance;
        closestRegion = seed.id;
      }
    }

    regionByTileIndex[tile.index] = closestRegion;
    const regionTiles = tileIndicesByRegion[closestRegion];

    if (!regionTiles) {
      throw new Error(`Voronoi assignment failed for region id ${closestRegion}.`);
    }

    regionTiles.push(tile.index);
  }

  const neighborSets = seeds.map(() => new Set<number>());

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    const regionId = regionByTileIndex[tileIndex];

    if (typeof regionId !== 'number' || regionId < 0) {
      continue;
    }

    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

    for (const neighborIndex of neighbors) {
      if (typeof neighborIndex !== 'number' || neighborIndex < 0) {
        continue;
      }

      const neighborRegionId = regionByTileIndex[neighborIndex];

      if (
        typeof neighborRegionId !== 'number' ||
        neighborRegionId < 0 ||
        neighborRegionId === regionId
      ) {
        continue;
      }

      const regionNeighbors = neighborSets[regionId];
      regionNeighbors?.add(neighborRegionId);
    }
  }

  const regions: VoronoiRegion[] = seeds.map((seed) => {
    const tileIndices = tileIndicesByRegion[seed.id] ?? [];

    if (!tileIndices.length) {
      return {
        id: seed.id,
        seed,
        tileIndices,
        centroidCol: seed.col,
        centroidRow: seed.row,
        neighborRegionIds: [],
      };
    }

    let totalCol = 0;
    let totalRow = 0;

    for (const tileIndex of tileIndices) {
      const tile = grid.tiles[tileIndex];

      if (!tile) {
        continue;
      }

      totalCol += tile.col;
      totalRow += tile.row;
    }

    const neighbors = [...(neighborSets[seed.id] ?? [])].sort((left, right) => left - right);

    return {
      id: seed.id,
      seed,
      tileIndices,
      centroidCol: totalCol / tileIndices.length,
      centroidRow: totalRow / tileIndices.length,
      neighborRegionIds: neighbors,
    };
  });

  return {
    regionByTileIndex,
    regions,
  };
};
