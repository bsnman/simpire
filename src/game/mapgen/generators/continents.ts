import type { TileType } from '~/base/tiles';

import type {
  MapGeneratorContext,
  MapGeneratorDefinition,
  ValidationResult,
} from '~/game/mapgen/contracts';
import { axialDistance, percentileThreshold } from '~/game/mapgen/helpers';

export const CONTINENTS_GENERATOR_ID = 'continents';

export type ContinentsParams = {
  seaLevelPercent: number;
  continentCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateContinentsParams = (params: unknown): ValidationResult<ContinentsParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error: 'Params must be an object with seaLevelPercent and continentCount.',
    };
  }

  const seaLevelPercent = params.seaLevelPercent;
  const continentCount = params.continentCount;

  if (typeof seaLevelPercent !== 'number' || !Number.isFinite(seaLevelPercent)) {
    return {
      ok: false,
      error: 'seaLevelPercent must be a finite number.',
    };
  }

  if (seaLevelPercent < 0 || seaLevelPercent > 100) {
    return {
      ok: false,
      error: 'seaLevelPercent must be in the range 0..100.',
    };
  }

  if (
    typeof continentCount !== 'number' ||
    !Number.isInteger(continentCount) ||
    continentCount <= 0
  ) {
    return {
      ok: false,
      error: 'continentCount must be a positive integer.',
    };
  }

  return {
    ok: true,
    value: {
      seaLevelPercent,
      continentCount,
    },
  };
};

const selectContinentCenters = (
  context: MapGeneratorContext,
  targetCount: number,
): { q: number; r: number }[] => {
  const coords = context.createRectCoords();
  const centers: { q: number; r: number }[] = [];

  if (!coords.length || targetCount <= 0) {
    return centers;
  }

  centers.push(context.random.pick(coords));

  while (centers.length < targetCount) {
    const fallbackCoord = coords[0];

    if (!fallbackCoord) {
      throw new Error('Cannot select continent centers from an empty coordinate list.');
    }

    let candidate = fallbackCoord;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const coord of coords) {
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const center of centers) {
        nearestDistance = Math.min(nearestDistance, axialDistance(coord, center));
      }

      // Slight jitter avoids hard symmetry and keeps deterministic output.
      const score = nearestDistance + context.random.next() * 0.35;

      if (score > bestScore) {
        bestScore = score;
        candidate = coord;
      }
    }

    centers.push(candidate);
  }

  return centers;
};

const terrainForLand = (
  context: MapGeneratorContext,
  q: number,
  r: number,
  normalizedElevation: number,
): TileType => {
  const detailNoise = context.noiseAt(q, r, 'continents-terrain');
  const elevation = normalizedElevation * 0.82 + detailNoise * 0.18;

  if (elevation > 0.76) {
    return 'hill';
  }

  if (elevation > 0.46) {
    return 'plains';
  }

  return 'grass';
};

export const continentsMapGenerator: MapGeneratorDefinition<ContinentsParams> = {
  id: CONTINENTS_GENERATOR_ID,
  validateParams: validateContinentsParams,
  generateTiles: (context, params) => {
    const coords = context.createRectCoords();

    if (!coords.length) {
      return [];
    }

    const continentCount = Math.min(coords.length, params.continentCount);
    const centers = selectContinentCenters(context, continentCount);
    const influenceRadius = Math.max(2, Math.sqrt(coords.length / continentCount) * 0.9);

    const scores = coords.map((coord) => {
      let centerInfluence = 0;

      for (const center of centers) {
        const distance = axialDistance(coord, center);
        const influence = Math.exp(
          -(distance * distance) / (2 * influenceRadius * influenceRadius),
        );
        centerInfluence = Math.max(centerInfluence, influence);
      }

      const coastalNoise = context.noiseAt(coord.q, coord.r, 'continents-coast');
      const macroNoise = context.noiseAt(coord.q, coord.r, 'continents-macro');

      return centerInfluence * 0.76 + coastalNoise * 0.18 + macroNoise * 0.06;
    });

    const seaThreshold = percentileThreshold(scores, params.seaLevelPercent / 100);

    return coords.map((coord, index) => {
      const score = scores[index] ?? 0;

      if (score <= seaThreshold) {
        return {
          q: coord.q,
          r: coord.r,
          terrain: 'water' as const,
        };
      }

      const normalizedElevation = (score - seaThreshold) / Math.max(1e-6, 1 - seaThreshold);

      return {
        q: coord.q,
        r: coord.r,
        terrain: terrainForLand(context, coord.q, coord.r, normalizedElevation),
      };
    });
  },
};
