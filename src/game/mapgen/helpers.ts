import type { HexCoord } from '@/types/hex';

import type { SeededRandom } from '@/game/mapgen/random';

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
