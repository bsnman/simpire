import { clamp } from '/game/mapgen/helpers';
import { countLandNeighbors, isLandAt, type MapGrid } from '/game/mapgen/pipeline/support/grid';

export type RebalanceLandMaskOptions = {
  grid: MapGrid;
  landMask: Uint8Array;
  targetLandRatio: number;
  noiseAt: (q: number, r: number, salt?: string) => number;
  regionScoreByTile?: ArrayLike<number>;
};

export const countLandTiles = (landMask: ArrayLike<number>): number => {
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
