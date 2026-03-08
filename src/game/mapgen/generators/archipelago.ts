import type { TileType } from '~/base/tiles';
import { toHexKey } from '~/types/hex';

import type {
  MapGeneratorContext,
  MapGeneratorDefinition,
  ValidationResult,
} from '~/game/mapgen/contracts';
import {
  axialDistance,
  clamp,
  deriveSeaTerrains,
  percentileThreshold,
  uniqueRandomCoords,
} from '~/game/mapgen/helpers';

export const ARCHIPELAGO_GENERATOR_ID = 'archipelago';

export type ArchipelagoParams = {
  seaLevelPercent: number;
  islandDensity: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateArchipelagoParams = (params: unknown): ValidationResult<ArchipelagoParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error: 'Params must be an object with seaLevelPercent and islandDensity.',
    };
  }

  const seaLevelPercent = params.seaLevelPercent;
  const islandDensity = params.islandDensity;

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

  if (typeof islandDensity !== 'number' || !Number.isFinite(islandDensity)) {
    return {
      ok: false,
      error: 'islandDensity must be a finite number.',
    };
  }

  if (islandDensity <= 0 || islandDensity > 1) {
    return {
      ok: false,
      error: 'islandDensity must be in the range (0, 1].',
    };
  }

  return {
    ok: true,
    value: {
      seaLevelPercent,
      islandDensity,
    },
  };
};

const edgeAttenuation = (context: MapGeneratorContext, q: number, r: number): number => {
  const col = q + Math.floor(r / 2);
  const toVerticalEdge = Math.min(col, context.width - 1 - col);
  const toHorizontalEdge = Math.min(r, context.height - 1 - r);
  const edgeDistance = Math.min(toVerticalEdge, toHorizontalEdge);
  const edgeNormalizer = Math.max(1, (Math.min(context.width, context.height) - 1) / 2);
  const edgeRatio = clamp(edgeDistance / edgeNormalizer, 0, 1);

  return 0.48 + edgeRatio * 0.52;
};

const terrainForLand = (
  context: MapGeneratorContext,
  q: number,
  r: number,
  normalizedElevation: number,
): TileType => {
  const detailNoise = context.noiseAt(q, r, 'archipelago-terrain');
  const elevation = normalizedElevation * 0.74 + detailNoise * 0.26;

  if (elevation > 0.92) {
    return 'mountain';
  }

  if (elevation > 0.78) {
    return 'hill';
  }

  if (elevation > 0.5) {
    return 'plains';
  }

  return 'grassland';
};

export const archipelagoMapGenerator: MapGeneratorDefinition<ArchipelagoParams> = {
  id: ARCHIPELAGO_GENERATOR_ID,
  displayName: 'Archipelago',
  description: 'Scattered island chains with larger surrounding seas.',
  parameterDefinitions: [
    {
      key: 'seaLevelPercent',
      label: 'Sea Level (%)',
      description: 'Higher values produce smaller islands and more ocean.',
      defaultValue: 74,
      min: 0,
      max: 100,
      step: 1,
    },
    {
      key: 'islandDensity',
      label: 'Island Density',
      description: 'Controls how many island centers are generated.',
      defaultValue: 0.12,
      min: 0.01,
      max: 1,
      step: 0.01,
    },
  ],
  validateParams: validateArchipelagoParams,
  generateTiles: (context, params) => {
    const coords = context.createRectCoords();

    if (!coords.length) {
      return [];
    }

    const islandCount = clamp(Math.round(coords.length * params.islandDensity), 3, coords.length);
    const islandCenters = uniqueRandomCoords(coords, islandCount, context.random);
    const influenceRadius = Math.max(1.35, Math.sqrt(coords.length / islandCount) * 0.62);

    const scores = coords.map((coord) => {
      let influenceSum = 0;

      for (const center of islandCenters) {
        const distance = axialDistance(coord, center);
        influenceSum += Math.exp(-(distance * distance) / (2 * influenceRadius * influenceRadius));
      }

      const clusteredInfluence = Math.min(1, influenceSum * 0.46);
      const shapeNoise = context.noiseAt(coord.q, coord.r, 'archipelago-shape');
      const detailNoise = context.noiseAt(coord.q, coord.r, 'archipelago-detail');

      return (
        clusteredInfluence * edgeAttenuation(context, coord.q, coord.r) * 0.72 +
        shapeNoise * 0.2 +
        detailNoise * 0.08
      );
    });

    const seaThreshold = percentileThreshold(scores, params.seaLevelPercent / 100);

    const isLandByKey = new Set<string>();

    for (let index = 0; index < coords.length; index += 1) {
      const coord = coords[index];

      if (!coord) {
        continue;
      }

      const score = scores[index] ?? 0;

      if (score > seaThreshold) {
        isLandByKey.add(toHexKey(coord.q, coord.r));
      }
    }

    const seaTerrainsByKey = deriveSeaTerrains(
      coords,
      (coord) => isLandByKey.has(toHexKey(coord.q, coord.r)),
      context.noiseAt,
      'archipelago-sea',
    );

    return coords.map((coord, index) => {
      const score = scores[index] ?? 0;

      if (score <= seaThreshold) {
        return {
          q: coord.q,
          r: coord.r,
          terrain: seaTerrainsByKey.get(toHexKey(coord.q, coord.r)) ?? 'ocean',
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
