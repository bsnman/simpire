import { clamp } from '/game/mapgen/helpers';
import type {
  DetailPassState,
  MapgenPipelineStage,
  MapgenPipelineState,
} from '/game/mapgen/pipeline/contracts';
import { clamp01 } from '/game/mapgen/pipeline/support/fields';
import {
  buildDeterministicShuffle,
  countLandNeighbors,
  isLandAt,
  type MapGrid,
} from '/game/mapgen/pipeline/support/grid';
import { rebalanceLandMaskToTarget } from '/game/mapgen/pipeline/support/land-mask';
import type { SeededRandom } from '/game/mapgen/random';

export type DetailPassConfig = {
  coastlineRoughness: number;
  targetLandRatio: number;
  random: SeededRandom;
  noiseAt: (q: number, r: number, salt?: string) => number;
  regionScoreByTile?: ArrayLike<number>;
};

const lerp = (start: number, end: number, amount: number): number => start + (end - start) * amount;

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

const sampleValueNoise = (
  noiseAt: (q: number, r: number, salt?: string) => number,
  x: number,
  y: number,
  salt: string,
): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);

  const v00 = noiseAt(x0, y0, salt);
  const v10 = noiseAt(x1, y0, salt);
  const v01 = noiseAt(x0, y1, salt);
  const v11 = noiseAt(x1, y1, salt);

  const lower = lerp(v00, v10, tx);
  const upper = lerp(v01, v11, tx);

  return lerp(lower, upper, ty);
};

const sampleFractalNoise = (
  noiseAt: (q: number, r: number, salt?: string) => number,
  x: number,
  y: number,
  salt: string,
  octaves: number,
): number => {
  let amplitude = 1;
  let frequency = 1;
  let value = 0;
  let amplitudeSum = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value +=
      sampleValueNoise(noiseAt, x * frequency, y * frequency, `${salt}-o${octave}`) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return amplitudeSum > 0 ? value / amplitudeSum : 0;
};

export const applyDetailPass = (
  grid: MapGrid,
  startingLandMask: ArrayLike<number>,
  startingElevation: ArrayLike<number>,
  config: DetailPassConfig,
): DetailPassState => {
  const landMask = Uint8Array.from(startingLandMask);
  const elevation = Float64Array.from(startingElevation);

  if (!grid.tiles.length) {
    return {
      landMask,
      elevation,
      coastlineMutations: 0,
    };
  }

  const roughness = clamp(config.coastlineRoughness, 0, 1);
  const shuffledIndices = buildDeterministicShuffle(grid.tiles.length, config.random);
  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3];
  let coastlineMutations = 0;

  for (const tileIndex of shuffledIndices) {
    const tile = grid.tiles[tileIndex];

    if (!tile) {
      continue;
    }

    const x = tile.col / Math.max(1, grid.width - 1);
    const y = tile.row / Math.max(1, grid.height - 1);
    const warpX = sampleFractalNoise(config.noiseAt, x * 3.8 + 17.13, y * 3.8 - 3.71, 'warp-x', 2);
    const warpY = sampleFractalNoise(config.noiseAt, x * 3.8 - 9.41, y * 3.8 + 5.29, 'warp-y', 2);
    const warpAmount = 0.12 + roughness * 0.2;
    const warpedX = x + (warpX - 0.5) * warpAmount;
    const warpedY = y + (warpY - 0.5) * warpAmount;

    let rotatedBlend = 0;

    for (const angle of angles) {
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      const rotatedX = (warpedX * cosAngle - warpedY * sinAngle) * (3 + roughness * 4);
      const rotatedY = (warpedX * sinAngle + warpedY * cosAngle) * (3 + roughness * 4);
      rotatedBlend += sampleFractalNoise(
        config.noiseAt,
        rotatedX,
        rotatedY,
        `rot-${angle.toFixed(4)}`,
        3,
      );
    }

    const detail = rotatedBlend / angles.length - 0.5;
    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];
    const neighborLandCount = countLandNeighbors(neighbors, landMask);
    const isCoastTile = neighborLandCount > 0 && neighborLandCount < 6;

    const baseDelta = detail * (0.03 + roughness * 0.11);
    elevation[tileIndex] = clamp01(
      (elevation[tileIndex] ?? 0) + baseDelta * (isCoastTile ? 1.4 : 0.5),
    );

    if (!isCoastTile) {
      continue;
    }

    const currentLand = isLandAt(landMask, tileIndex);
    const toWaterThreshold = -0.56 + roughness * 0.38;
    const toLandThreshold = 0.56 - roughness * 0.38;

    if (currentLand && neighborLandCount <= 3 && detail < toWaterThreshold) {
      landMask[tileIndex] = 0;
      coastlineMutations += 1;
      continue;
    }

    if (!currentLand && neighborLandCount >= 3 && detail > toLandThreshold) {
      landMask[tileIndex] = 1;
      coastlineMutations += 1;
    }
  }

  rebalanceLandMaskToTarget({
    grid,
    landMask,
    targetLandRatio: config.targetLandRatio,
    noiseAt: config.noiseAt,
    regionScoreByTile: config.regionScoreByTile,
  });

  return {
    landMask,
    elevation,
    coastlineMutations,
  };
};

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<
    Pick<
      MapgenPipelineState,
      'grid' | 'macroLandMask' | 'tectonics' | 'subseeds' | 'clampedLandRatio'
    >
  > => {
  if (
    !state.grid ||
    !state.macroLandMask ||
    !state.tectonics ||
    !state.subseeds ||
    typeof state.clampedLandRatio !== 'number'
  ) {
    throw new Error('Detail stage requires tectonics and land mask outputs.');
  }

  return state as MapgenPipelineState &
    Required<
      Pick<
        MapgenPipelineState,
        'grid' | 'macroLandMask' | 'tectonics' | 'subseeds' | 'clampedLandRatio'
      >
    >;
};

export const detailNoiseStage: MapgenPipelineStage = {
  id: '05-detail-noise',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      detailPass: applyDetailPass(
        nextState.grid,
        nextState.macroLandMask.landMask,
        nextState.tectonics.elevation,
        {
          coastlineRoughness: nextState.profile.coastlineRoughness,
          targetLandRatio: nextState.clampedLandRatio,
          random: nextState.subseeds.random('detail'),
          noiseAt: (q, r, salt) => nextState.subseeds.noiseAt('detail', q, r, salt),
          regionScoreByTile: nextState.macroLandMask.regionScoreByTile,
        },
      ),
    };
  },
};
