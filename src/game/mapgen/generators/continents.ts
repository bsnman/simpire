import {
  type MapGeneratorDefinition,
  type ValidationResult,
  type MapGeneratorContext,
} from '~/game/mapgen/contracts';
import { clamp } from '~/game/mapgen/helpers';
import { runGeneratorPipeline } from '~/game/mapgen/pipeline/run';

export const CONTINENTS_GENERATOR_ID = 'continents';

export type ContinentsParams = {
  landRatio: number;
  landmassSize: number;
  landmassCountMin: number;
  landmassCountMax: number;
  tectonicStrength: number;
  coastlineRoughness: number;
  mountainIntensity: number;
};

type LegacyContinentsParams = {
  seaLevelPercent?: number;
  continentCount?: number;
  continentCountTarget?: number;
  landmassCount?: number;
  landmassCountMin?: number;
  landmassCountMax?: number;
};

const DEFAULT_PARAMS: ContinentsParams = {
  landRatio: 0.32,
  landmassSize: 0.5,
  landmassCountMin: 2,
  landmassCountMax: 2,
  tectonicStrength: 0.62,
  coastlineRoughness: 0.58,
  mountainIntensity: 0.58,
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

  const seaLevelPercent = readFiniteNumber(record as LegacyContinentsParams, 'seaLevelPercent');

  if (typeof seaLevelPercent === 'number') {
    return 1 - seaLevelPercent / 100;
  }

  return undefined;
};

const normalizeLandmassCountTarget = (record: Record<string, unknown>): number | undefined => {
  const explicitLandmassCount = readFiniteNumber(record as LegacyContinentsParams, 'landmassCount');

  if (typeof explicitLandmassCount === 'number') {
    return explicitLandmassCount;
  }

  const explicitContinentCount = readFiniteNumber(
    record as LegacyContinentsParams,
    'continentCountTarget',
  );

  if (typeof explicitContinentCount === 'number') {
    return explicitContinentCount;
  }

  return readFiniteNumber(record as LegacyContinentsParams, 'continentCount');
};

const normalizeLandmassCountRange = (
  record: Record<string, unknown>,
): { min: number; max: number } | undefined => {
  const explicitTarget = normalizeLandmassCountTarget(record);
  const explicitMin = readFiniteNumber(record as LegacyContinentsParams, 'landmassCountMin');
  const explicitMax = readFiniteNumber(record as LegacyContinentsParams, 'landmassCountMax');

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

  const sizeMultiplier = 0.72 + landmassSize * 0.56;
  return clamp(landRatio * sizeMultiplier, 0, 1);
};

const validateContinentsParams = (params: unknown): ValidationResult<ContinentsParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error:
        'Params must be an object with landRatio, landmassCount (or landmassCountMin/Max), landmassSize, tectonicStrength, coastlineRoughness, and mountainIntensity.',
    };
  }

  const landRatio = normalizeLandRatio(params) ?? DEFAULT_PARAMS.landRatio;

  if (landRatio < 0 || landRatio > 1) {
    return {
      ok: false,
      error: 'landRatio must be in the range 0..1 (or provide seaLevelPercent in 0..100).',
    };
  }

  const landmassSize = readFiniteNumber(params, 'landmassSize') ?? DEFAULT_PARAMS.landmassSize;

  if (landmassSize < 0 || landmassSize > 1) {
    return {
      ok: false,
      error: 'landmassSize must be in the range 0..1.',
    };
  }

  const landmassCountRange =
    normalizeLandmassCountRange(params) ??
    ({
      min: DEFAULT_PARAMS.landmassCountMin,
      max: DEFAULT_PARAMS.landmassCountMax,
    } as const);
  const landmassCountRangeResult = validateLandmassCountRange(landmassCountRange);

  if (!landmassCountRangeResult.ok) {
    return landmassCountRangeResult;
  }

  const tectonicStrength =
    readFiniteNumber(params, 'tectonicStrength') ?? DEFAULT_PARAMS.tectonicStrength;

  if (tectonicStrength < 0 || tectonicStrength > 1) {
    return {
      ok: false,
      error: 'tectonicStrength must be in the range 0..1.',
    };
  }

  const coastlineRoughness =
    readFiniteNumber(params, 'coastlineRoughness') ?? DEFAULT_PARAMS.coastlineRoughness;

  if (coastlineRoughness < 0 || coastlineRoughness > 1) {
    return {
      ok: false,
      error: 'coastlineRoughness must be in the range 0..1.',
    };
  }

  const mountainIntensity =
    readFiniteNumber(params, 'mountainIntensity') ?? DEFAULT_PARAMS.mountainIntensity;

  if (mountainIntensity < 0 || mountainIntensity > 1) {
    return {
      ok: false,
      error: 'mountainIntensity must be in the range 0..1.',
    };
  }

  return {
    ok: true,
    value: {
      landRatio: computeEffectiveLandRatio(landRatio, landmassSize),
      landmassSize,
      landmassCountMin: landmassCountRangeResult.value.min,
      landmassCountMax: landmassCountRangeResult.value.max,
      tectonicStrength,
      coastlineRoughness,
      mountainIntensity,
    },
  };
};

const buildContinentsPipelineConfig = (context: MapGeneratorContext, params: ContinentsParams) => {
  const mapArea = context.width * context.height;
  const averageLandmassCount = (params.landmassCountMin + params.landmassCountMax) / 2;
  const clampedLandmassSize = clamp(params.landmassSize, 0, 1);
  const poissonMinDistance = clamp(
    Math.sqrt(mapArea / Math.max(4, averageLandmassCount * 3.8)) *
      (0.82 + clampedLandmassSize * 0.24),
    2.2,
    Math.max(context.width, context.height),
  );

  return {
    scriptId: CONTINENTS_GENERATOR_ID,
    landRatio: params.landRatio,
    poissonMinDistance,
    poissonAttempts: 26,
    poissonMaxSeeds: Math.max(params.landmassCountMax * 10, 24),
    primaryRegionTarget: Math.round(averageLandmassCount),
    primaryRegionTargetMin: params.landmassCountMin,
    primaryRegionTargetMax: params.landmassCountMax,
    largeMassBias: clamp(0.44 + clampedLandmassSize * 0.48, 0, 1),
    fragmentation: clamp(
      0.3 - clampedLandmassSize * 0.18 + params.coastlineRoughness * 0.16,
      0.04,
      0.72,
    ),
    chainTendency: clamp(0.28 + (1 - clampedLandmassSize) * 0.14, 0, 1),
    edgeOceanBias: clamp(0.26 - clampedLandmassSize * 0.1, 0, 1),
    tectonicStrength: params.tectonicStrength,
    coastlineRoughness: params.coastlineRoughness,
    mountainIntensity: params.mountainIntensity,
    shelfWidth: 2,
  };
};

export const continentsMapGenerator: MapGeneratorDefinition<ContinentsParams> = {
  id: CONTINENTS_GENERATOR_ID,
  displayName: 'Continents',
  description: 'Large connected landmasses shaped by region macro structure and tectonics.',
  parameterDefinitions: [
    {
      key: 'landmassCount',
      label: 'Landmass Count',
      description: 'Exact number of major landmasses to target.',
      defaultValue: DEFAULT_PARAMS.landmassCountMin,
      min: 1,
      max: 20,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassCountMin',
      label: 'Landmass Min',
      description: 'Lower bound for deterministic random landmass count.',
      defaultValue: DEFAULT_PARAMS.landmassCountMin,
      min: 1,
      max: 20,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassCountMax',
      label: 'Landmass Max',
      description: 'Upper bound for deterministic random landmass count.',
      defaultValue: DEFAULT_PARAMS.landmassCountMax,
      min: 1,
      max: 20,
      step: 1,
      integer: true,
    },
    {
      key: 'landmassSize',
      label: 'Landmass Size',
      description: 'Larger values create bigger connected landmasses and can remove seas.',
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
      key: 'tectonicStrength',
      label: 'Tectonic Strength',
      description: 'Controls how strongly boundary uplift/depression shapes elevation.',
      defaultValue: DEFAULT_PARAMS.tectonicStrength,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'coastlineRoughness',
      label: 'Coastline Roughness',
      description: 'Higher values create more broken coastlines and shore variance.',
      defaultValue: DEFAULT_PARAMS.coastlineRoughness,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'mountainIntensity',
      label: 'Mountain Intensity',
      description: 'Adjusts mountain/hill prevalence in elevated regions.',
      defaultValue: DEFAULT_PARAMS.mountainIntensity,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  validateParams: validateContinentsParams,
  generateTiles: (context, params) =>
    runGeneratorPipeline(context, buildContinentsPipelineConfig(context, params)).tiles,
};
