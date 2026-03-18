import { clamp } from '/game/mapgen/helpers';
import {
  type MapGeneratorContext,
  type MapGeneratorDefinition,
  type ValidationResult,
} from '/game/mapgen/contracts';
import { runMapgenPipeline } from '/game/mapgen/pipeline/execute';
import type { MapgenPipelineProfile } from '/game/mapgen/pipeline/contracts';

export const ARCHIPELAGO_GENERATOR_ID = 'archipelago';

export type ArchipelagoParams = {
  landRatio: number;
  landmassSize: number;
  landmassCountMin: number;
  landmassCountMax: number;
  chainTendency: number;
  shelfWidth: number;
  tectonicStrength: number;
  elevationSprayDensity: number;
};

type LegacyArchipelagoParams = {
  seaLevelPercent?: number;
  islandDensity?: number;
  islandSizeBias?: number;
  landmassCount?: number;
  landmassCountMin?: number;
  landmassCountMax?: number;
};

const DEFAULT_PARAMS: ArchipelagoParams = {
  landRatio: 0.24,
  landmassSize: 0.36,
  landmassCountMin: 11,
  landmassCountMax: 11,
  chainTendency: 0.64,
  shelfWidth: 1,
  tectonicStrength: 0.52,
  elevationSprayDensity: 0.5,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readFiniteNumber = (source: Record<string, unknown>, key: string): number | undefined => {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const normalizeLandRatio = (record: Record<string, unknown>): number | undefined => {
  const explicitLandRatio = readFiniteNumber(record, 'landRatio');

  if (typeof explicitLandRatio === 'number') {
    return explicitLandRatio;
  }

  const seaLevelPercent = readFiniteNumber(record as LegacyArchipelagoParams, 'seaLevelPercent');

  if (typeof seaLevelPercent === 'number') {
    return 1 - seaLevelPercent / 100;
  }

  return undefined;
};

const normalizeLandmassSize = (record: Record<string, unknown>): number | undefined => {
  const explicitSize = readFiniteNumber(record, 'landmassSize');

  if (typeof explicitSize === 'number') {
    return explicitSize;
  }

  const legacySizeBias = readFiniteNumber(record as LegacyArchipelagoParams, 'islandSizeBias');

  if (typeof legacySizeBias === 'number') {
    return legacySizeBias;
  }

  const legacyDensity = readFiniteNumber(record as LegacyArchipelagoParams, 'islandDensity');

  if (typeof legacyDensity === 'number') {
    return clamp(1 - legacyDensity, 0, 1);
  }

  return undefined;
};

const normalizeLandmassCountRange = (
  record: Record<string, unknown>,
  fallbackLandmassSize: number,
): { min: number; max: number } | undefined => {
  const explicitTarget = readFiniteNumber(record as LegacyArchipelagoParams, 'landmassCount');
  const explicitMin = readFiniteNumber(record as LegacyArchipelagoParams, 'landmassCountMin');
  const explicitMax = readFiniteNumber(record as LegacyArchipelagoParams, 'landmassCountMax');

  if (typeof explicitTarget === 'number') {
    const rounded = Math.round(explicitTarget);
    return { min: rounded, max: rounded };
  }

  if (typeof explicitMin === 'number' || typeof explicitMax === 'number') {
    const min = Math.round(explicitMin ?? explicitMax ?? Number.NaN);
    const max = Math.round(explicitMax ?? explicitMin ?? Number.NaN);
    return {
      min,
      max,
    };
  }

  const legacySizeBias = readFiniteNumber(record as LegacyArchipelagoParams, 'islandSizeBias');

  if (typeof legacySizeBias === 'number') {
    const legacyDerivedTarget = Math.max(4, Math.round(6 + (1 - legacySizeBias) * 8));
    return {
      min: legacyDerivedTarget,
      max: legacyDerivedTarget,
    };
  }

  const legacyDensity = readFiniteNumber(record as LegacyArchipelagoParams, 'islandDensity');

  if (typeof legacyDensity === 'number') {
    const densityAdjustedTarget = Math.max(
      4,
      Math.round(5 + clamp(legacyDensity, 0, 1) * 10 + (1 - fallbackLandmassSize) * 3),
    );
    return {
      min: densityAdjustedTarget,
      max: densityAdjustedTarget,
    };
  }

  return undefined;
};

const validateLandmassCountRange = (range: {
  min: number;
  max: number;
}): ValidationResult<{ min: number; max: number }> => {
  if (!Number.isInteger(range.min) || range.min <= 0) {
    return {
      ok: false,
      error: 'landmassCount/landmassCountMin must be a positive integer.',
    };
  }

  if (!Number.isInteger(range.max) || range.max <= 0) {
    return {
      ok: false,
      error: 'landmassCount/landmassCountMax must be a positive integer.',
    };
  }

  if (range.max < range.min) {
    return {
      ok: false,
      error: 'landmassCountMax must be greater than or equal to landmassCountMin.',
    };
  }

  return {
    ok: true,
    value: range,
  };
};

const computeEffectiveLandRatio = (landRatio: number, landmassSize: number): number => {
  if (landmassSize >= 0.98) {
    return 1;
  }

  const sizeMultiplier = clamp(1 + (landmassSize - DEFAULT_PARAMS.landmassSize) * 0.9, 0.5, 1.5);
  return clamp(landRatio * sizeMultiplier, 0, 1);
};

const validateArchipelagoParams = (params: unknown): ValidationResult<ArchipelagoParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error:
        'Params must be an object with landRatio, landmassCount (or landmassCountMin/Max), landmassSize, chainTendency, shelfWidth, and tectonicStrength.',
    };
  }

  const landRatio = normalizeLandRatio(params) ?? DEFAULT_PARAMS.landRatio;

  if (landRatio < 0 || landRatio > 1) {
    return {
      ok: false,
      error: 'landRatio must be in the range 0..1 (or provide seaLevelPercent in 0..100).',
    };
  }

  const landmassSize = normalizeLandmassSize(params) ?? DEFAULT_PARAMS.landmassSize;

  if (landmassSize < 0 || landmassSize > 1) {
    return {
      ok: false,
      error: 'landmassSize must be in the range 0..1.',
    };
  }

  const landmassCountRange =
    normalizeLandmassCountRange(params, landmassSize) ??
    ({
      min: DEFAULT_PARAMS.landmassCountMin,
      max: DEFAULT_PARAMS.landmassCountMax,
    } as const);
  const landmassCountRangeResult = validateLandmassCountRange(landmassCountRange);

  if (!landmassCountRangeResult.ok) {
    return landmassCountRangeResult;
  }

  const chainTendency = readFiniteNumber(params, 'chainTendency') ?? DEFAULT_PARAMS.chainTendency;

  if (chainTendency < 0 || chainTendency > 1) {
    return {
      ok: false,
      error: 'chainTendency must be in the range 0..1.',
    };
  }

  const shelfWidth = readFiniteNumber(params, 'shelfWidth') ?? DEFAULT_PARAMS.shelfWidth;

  if (!Number.isInteger(shelfWidth) || shelfWidth < 1 || shelfWidth > 8) {
    return {
      ok: false,
      error: 'shelfWidth must be an integer in the range 1..8.',
    };
  }

  const tectonicStrength =
    readFiniteNumber(params, 'tectonicStrength') ?? DEFAULT_PARAMS.tectonicStrength;

  if (tectonicStrength < 0 || tectonicStrength > 1) {
    return {
      ok: false,
      error: 'tectonicStrength must be in the range 0..1.',
    };
  }

  const elevationSprayDensity =
    readFiniteNumber(params, 'elevationSprayDensity') ?? DEFAULT_PARAMS.elevationSprayDensity;

  if (elevationSprayDensity < 0 || elevationSprayDensity > 1) {
    return {
      ok: false,
      error: 'elevationSprayDensity must be in the range 0..1.',
    };
  }

  return {
    ok: true,
    value: {
      landRatio: computeEffectiveLandRatio(landRatio, landmassSize),
      landmassSize,
      landmassCountMin: landmassCountRangeResult.value.min,
      landmassCountMax: landmassCountRangeResult.value.max,
      chainTendency,
      shelfWidth,
      tectonicStrength,
      elevationSprayDensity,
    },
  };
};

const buildArchipelagoPipelineProfile = (
  context: MapGeneratorContext,
  params: ArchipelagoParams,
): MapgenPipelineProfile => {
  const mapArea = context.width * context.height;
  const clampedLandmassSize = clamp(params.landmassSize, 0, 1);
  const averageLandmassCount = (params.landmassCountMin + params.landmassCountMax) / 2;
  const poissonMinDistance = clamp(
    Math.sqrt(mapArea / Math.max(8, averageLandmassCount * 2.6)) *
      (0.58 + clampedLandmassSize * 0.48),
    1.8,
    Math.max(context.width, context.height),
  );

  return {
    scriptId: ARCHIPELAGO_GENERATOR_ID,
    landRatio: params.landRatio,
    poissonMinDistance,
    poissonAttempts: 30,
    poissonMaxSeeds: Math.max(params.landmassCountMax * 4, 30),
    primaryRegionTarget: Math.round(averageLandmassCount),
    primaryRegionTargetMin: params.landmassCountMin,
    primaryRegionTargetMax: params.landmassCountMax,
    largeMassBias: clamp(0.2 + clampedLandmassSize * 0.35, 0, 1),
    fragmentation: clamp(0.58 - clampedLandmassSize * 0.34, 0.08, 0.84),
    chainTendency: params.chainTendency,
    edgeOceanBias: clamp(0.42 - clampedLandmassSize * 0.16, 0, 1),
    tectonicStrength: params.tectonicStrength,
    coastlineRoughness: 0.74,
    mountainIntensity: clamp(0.42 + params.tectonicStrength * 0.25, 0, 1),
    elevationSprayDensity: params.elevationSprayDensity,
    shelfWidth: params.shelfWidth,
  };
};

export const archipelagoMapGenerator: MapGeneratorDefinition<ArchipelagoParams> = {
  id: ARCHIPELAGO_GENERATOR_ID,
  displayName: 'Archipelago',
  description: 'Fragmented island groups with chain-biased macro shaping.',
  parameterDefinitions: [
    {
      key: 'landmassCount',
      label: 'Landmass Count',
      description: 'Exact number of islands/landmasses to target.',
      defaultValue: DEFAULT_PARAMS.landmassCountMin,
      min: 1,
      max: 40,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassCountMin',
      label: 'Landmass Min',
      description: 'Lower bound for deterministic random landmass count.',
      defaultValue: DEFAULT_PARAMS.landmassCountMin,
      min: 1,
      max: 40,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassCountMax',
      label: 'Landmass Max',
      description: 'Upper bound for deterministic random landmass count.',
      defaultValue: DEFAULT_PARAMS.landmassCountMax,
      min: 1,
      max: 40,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassSize',
      label: 'Landmass Size',
      description: 'Larger values create bigger islands and can remove seas.',
      defaultValue: DEFAULT_PARAMS.landmassSize,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'landRatio',
      label: 'Base Land Ratio',
      description: 'Baseline map land ratio before landmass-size scaling.',
      defaultValue: DEFAULT_PARAMS.landRatio,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'chainTendency',
      label: 'Chain Tendency',
      description: 'Higher values encourage island chaining during macro pass.',
      defaultValue: DEFAULT_PARAMS.chainTendency,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'shelfWidth',
      label: 'Shelf Width',
      description: 'Controls how many sea rings classify as coastal shelf waters.',
      defaultValue: DEFAULT_PARAMS.shelfWidth,
      min: 1,
      max: 8,
      step: 1,
      integer: true,
    },
    {
      key: 'tectonicStrength',
      label: 'Tectonic Strength',
      description: 'Controls boundary-driven uplift and ridge prominence.',
      defaultValue: DEFAULT_PARAMS.tectonicStrength,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'elevationSprayDensity',
      label: 'Elevation Spray',
      description: 'Adds sparse post-generation hills and occasional mountains across land tiles.',
      defaultValue: DEFAULT_PARAMS.elevationSprayDensity,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  validateParams: validateArchipelagoParams,
  generateTiles: (context, params) =>
    runMapgenPipeline(context, buildArchipelagoPipelineProfile(context, params)).tiles,
};
