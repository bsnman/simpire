import type { HexCoord, HexKey } from '~/types/hex';
import { toHexKey } from '~/types/hex';

import { createRectCoords } from '~/game/mapgen/helpers';
import type { SeededRandom } from '~/game/mapgen/random';

export const AXIAL_NEIGHBOR_OFFSETS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export type GridTile = {
  index: number;
  q: number;
  r: number;
  col: number;
  row: number;
  key: HexKey;
};

export type MapGrid = {
  width: number;
  height: number;
  tiles: GridTile[];
  keyToIndex: Map<HexKey, number>;
  neighborsByIndex: number[][];
};

export const axialToOffsetColumn = (q: number, r: number): number => q + Math.floor(r / 2);

export const createMapGrid = (
  width: number,
  height: number,
  createCoords: () => HexCoord[] = () => createRectCoords(width, height),
): MapGrid => {
  const coords = createCoords();
  const tiles: GridTile[] = [];
  const keyToIndex = new Map<HexKey, number>();

  for (const coord of coords) {
    const key = toHexKey(coord.q, coord.r);

    if (keyToIndex.has(key)) {
      throw new Error(`Duplicate grid coordinate key "${key}".`);
    }

    const index = tiles.length;
    keyToIndex.set(key, index);
    tiles.push({
      index,
      q: coord.q,
      r: coord.r,
      col: axialToOffsetColumn(coord.q, coord.r),
      row: coord.r,
      key,
    });
  }

  const neighborsByIndex = tiles.map((tile) =>
    AXIAL_NEIGHBOR_OFFSETS.map((offset) => {
      const neighborKey = toHexKey(tile.q + offset.q, tile.r + offset.r);
      return keyToIndex.get(neighborKey) ?? -1;
    }),
  );

  return {
    width,
    height,
    tiles,
    keyToIndex,
    neighborsByIndex,
  };
};

export const buildDeterministicShuffle = (length: number, random: SeededRandom): number[] => {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error('Deterministic shuffle length must be a non-negative integer.');
  }

  const indices = Array.from({ length }, (_, index) => index);

  for (let current = length - 1; current > 0; current -= 1) {
    const swapIndex = random.int(0, current + 1);
    const currentValue = indices[current];
    const swapValue = indices[swapIndex];

    if (typeof currentValue === 'undefined' || typeof swapValue === 'undefined') {
      throw new Error('Deterministic shuffle encountered an invalid swap index.');
    }

    indices[current] = swapValue;
    indices[swapIndex] = currentValue;
  }

  return indices;
};

export const isLandAt = (landMask: ArrayLike<number>, index: number): boolean => {
  const value = landMask[index];
  return typeof value === 'number' && value > 0;
};

export const countLandNeighbors = (
  neighborsByDirection: readonly number[],
  landMask: ArrayLike<number>,
): number => {
  let count = 0;

  for (const neighborIndex of neighborsByDirection) {
    if (neighborIndex < 0) {
      continue;
    }

    if (isLandAt(landMask, neighborIndex)) {
      count += 1;
    }
  }

  return count;
};
