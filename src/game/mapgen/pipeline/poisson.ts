import type { SeededRandom } from '~/game/mapgen/random';

export type PoissonSeedPoint = {
  id: number;
  col: number;
  row: number;
};

export type PoissonSamplingConfig = {
  width: number;
  height: number;
  minDistance: number;
  maxAttempts?: number;
  maxPoints?: number;
  random: SeededRandom;
};

const distanceSquared = (
  leftCol: number,
  leftRow: number,
  rightCol: number,
  rightRow: number,
): number => {
  const deltaCol = leftCol - rightCol;
  const deltaRow = leftRow - rightRow;
  return deltaCol * deltaCol + deltaRow * deltaRow;
};

export const generatePoissonSeeds = ({
  width,
  height,
  minDistance,
  maxAttempts = 30,
  maxPoints = Number.POSITIVE_INFINITY,
  random,
}: PoissonSamplingConfig): PoissonSeedPoint[] => {
  if (width <= 0 || height <= 0) {
    return [];
  }

  if (!Number.isFinite(minDistance) || minDistance <= 0) {
    throw new Error('Poisson sampling requires a positive minDistance value.');
  }

  const maxCount = Number.isFinite(maxPoints)
    ? Math.floor(Math.max(1, maxPoints))
    : Number.MAX_SAFE_INTEGER;
  const cellSize = minDistance / Math.SQRT2;
  const accelCols = Math.max(1, Math.ceil(width / cellSize));
  const accelRows = Math.max(1, Math.ceil(height / cellSize));
  const accelGrid = new Int32Array(accelCols * accelRows);
  accelGrid.fill(-1);

  const samples: { col: number; row: number }[] = [];
  const activeIndices: number[] = [];

  const toAccelIndex = (col: number, row: number): number => row * accelCols + col;

  const registerSample = (sample: { col: number; row: number }) => {
    const sampleIndex = samples.length;
    samples.push(sample);
    activeIndices.push(sampleIndex);

    const accelCol = Math.floor(sample.col / cellSize);
    const accelRow = Math.floor(sample.row / cellSize);
    const clampedCol = Math.max(0, Math.min(accelCols - 1, accelCol));
    const clampedRow = Math.max(0, Math.min(accelRows - 1, accelRow));
    accelGrid[toAccelIndex(clampedCol, clampedRow)] = sampleIndex;
  };

  registerSample({
    col: random.next() * width,
    row: random.next() * height,
  });

  const minDistanceSquared = minDistance * minDistance;

  while (activeIndices.length > 0 && samples.length < maxCount) {
    const activeListIndex = random.int(0, activeIndices.length);
    const sampleIndex = activeIndices[activeListIndex];

    if (typeof sampleIndex === 'undefined') {
      throw new Error('Poisson sampler failed to read active sample index.');
    }

    const origin = samples[sampleIndex];

    if (!origin) {
      throw new Error('Poisson sampler encountered an invalid active sample.');
    }

    let accepted = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const angle = random.next() * Math.PI * 2;
      const radius = minDistance * (1 + random.next());
      const candidateCol = origin.col + Math.cos(angle) * radius;
      const candidateRow = origin.row + Math.sin(angle) * radius;

      if (candidateCol < 0 || candidateRow < 0 || candidateCol >= width || candidateRow >= height) {
        continue;
      }

      const accelCol = Math.floor(candidateCol / cellSize);
      const accelRow = Math.floor(candidateRow / cellSize);

      let blocked = false;

      for (
        let scanRow = Math.max(0, accelRow - 2);
        scanRow <= Math.min(accelRows - 1, accelRow + 2);
        scanRow += 1
      ) {
        for (
          let scanCol = Math.max(0, accelCol - 2);
          scanCol <= Math.min(accelCols - 1, accelCol + 2);
          scanCol += 1
        ) {
          const neighborIndex = accelGrid[toAccelIndex(scanCol, scanRow)] ?? -1;

          if (neighborIndex < 0) {
            continue;
          }

          const neighbor = samples[neighborIndex];

          if (!neighbor) {
            continue;
          }

          if (
            distanceSquared(candidateCol, candidateRow, neighbor.col, neighbor.row) <
            minDistanceSquared
          ) {
            blocked = true;
            break;
          }
        }

        if (blocked) {
          break;
        }
      }

      if (blocked) {
        continue;
      }

      registerSample({ col: candidateCol, row: candidateRow });
      accepted = true;
      break;
    }

    if (!accepted) {
      const removed = activeIndices.splice(activeListIndex, 1);

      if (!removed.length) {
        throw new Error('Poisson sampler failed to retire inactive sample.');
      }
    }
  }

  return samples.map((sample, index) => ({
    id: index,
    col: sample.col,
    row: sample.row,
  }));
};
