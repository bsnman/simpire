import type { HexCoord } from '~/types/hex';
import { toHexKey } from '~/types/hex';
import type { TileType } from '~/base/tiles';

import type { SeededRandom } from '~/game/mapgen/random';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const createRectCoords = (width: number, height: number): HexCoord[] => {
  const coords: HexCoord[] = [];

  for (let r = 0; r < height; r += 1) {
    for (let col = 0; col < width; col += 1) {
      const q = col - Math.floor(r / 2);
      coords.push({ q, r });
    }
  }

  return coords;
};

export const axialDistance = (a: HexCoord, b: HexCoord): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);

  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
};

export const percentileThreshold = (scores: readonly number[], percentile: number): number => {
  if (!scores.length) {
    return 0;
  }

  const clampedPercentile = clamp(percentile, 0, 1);
  const sortedScores = [...scores].sort((left, right) => left - right);
  const thresholdIndex = Math.floor(clampedPercentile * (sortedScores.length - 1));
  const thresholdValue = sortedScores[thresholdIndex];

  if (typeof thresholdValue === 'undefined') {
    return sortedScores[sortedScores.length - 1] ?? 0;
  }

  return thresholdValue;
};

export const uniqueRandomCoords = (
  coords: readonly HexCoord[],
  count: number,
  random: SeededRandom,
): HexCoord[] => {
  if (!coords.length || count <= 0) {
    return [];
  }

  const pool = [...coords];
  const targetCount = Math.min(pool.length, count);
  const selected: HexCoord[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const nextIndex = random.int(0, pool.length);
    const [coord] = pool.splice(nextIndex, 1);

    if (!coord) {
      throw new Error('Failed to select coordinate from random pool.');
    }

    selected.push(coord);
  }

  return selected;
};

const AXIAL_NEIGHBOR_OFFSETS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const deriveSeaTerrains = (
  coords: readonly HexCoord[],
  isLandAt: (coord: HexCoord, index: number) => boolean,
  noiseAt: (q: number, r: number, salt?: string) => number,
  saltPrefix: string,
): Map<string, TileType> => {
  const coordSet = new Set<string>();
  const landQueue: HexCoord[] = [];
  const distanceToLand = new Map<string, number>();
  const seaTerrainByKey = new Map<string, TileType>();

  for (let index = 0; index < coords.length; index += 1) {
    const coord = coords[index];

    if (!coord) {
      continue;
    }

    const key = toHexKey(coord.q, coord.r);
    coordSet.add(key);

    if (isLandAt(coord, index)) {
      landQueue.push(coord);
      distanceToLand.set(key, 0);
    }
  }

  if (!landQueue.length) {
    for (const coord of coords) {
      const key = toHexKey(coord.q, coord.r);
      seaTerrainByKey.set(key, 'ocean');
    }

    return seaTerrainByKey;
  }

  for (let queueIndex = 0; queueIndex < landQueue.length; queueIndex += 1) {
    const coord = landQueue[queueIndex];

    if (!coord) {
      continue;
    }

    const key = toHexKey(coord.q, coord.r);
    const baseDistance = distanceToLand.get(key) ?? 0;

    for (const offset of AXIAL_NEIGHBOR_OFFSETS) {
      const neighborQ = coord.q + offset.q;
      const neighborR = coord.r + offset.r;
      const neighborKey = toHexKey(neighborQ, neighborR);

      if (!coordSet.has(neighborKey) || distanceToLand.has(neighborKey)) {
        continue;
      }

      distanceToLand.set(neighborKey, baseDistance + 1);
      landQueue.push({ q: neighborQ, r: neighborR });
    }
  }

  for (const coord of coords) {
    const key = toHexKey(coord.q, coord.r);

    if (distanceToLand.get(key) === 0) {
      continue;
    }

    const distance = distanceToLand.get(key) ?? Number.POSITIVE_INFINITY;
    const noise = noiseAt(coord.q, coord.r, `${saltPrefix}-bands`);

    let seaTerrain: TileType = 'ocean';

    if (distance <= 1 || (distance === 2 && noise < 0.22)) {
      seaTerrain = 'coastal_sea';
    } else if (distance <= 3 || (distance === 4 && noise < 0.28)) {
      seaTerrain = 'deep_sea';
    }

    seaTerrainByKey.set(key, seaTerrain);
  }

  return seaTerrainByKey;
};
