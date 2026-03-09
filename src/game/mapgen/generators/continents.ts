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
  continentCountTarget: number;
  tectonicStrength: number;
  coastlineRoughness: number;
  mountainIntensity: number;
};

type LegacyContinentsParams = {
  seaLevelPercent?: number;
  continentCount?: number;
};

const DEFAULT_PARAMS: ContinentsParams = {
  landRatio: 0.32,
  continentCountTarget: 2,
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

const normalizeContinentCountTarget = (record: Record<string, unknown>): number | undefined => {
  const explicit = readFiniteNumber(record, 'continentCountTarget');

  if (typeof explicit === 'number') {
    return explicit;
  }

  return readFiniteNumber(record as LegacyContinentsParams, 'continentCount');
};

const validateContinentsParams = (params: unknown): ValidationResult<ContinentsParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error:
        'Params must be an object with landRatio, continentCountTarget, tectonicStrength, coastlineRoughness, and mountainIntensity.',
    };
  }

  const landRatio = normalizeLandRatio(params) ?? DEFAULT_PARAMS.landRatio;

  if (landRatio < 0 || landRatio > 1) {
    return {
      ok: false,
      error: 'landRatio must be in the range 0..1 (or provide seaLevelPercent in 0..100).',
    };
  }

  const continentCountTarget =
    normalizeContinentCountTarget(params) ?? DEFAULT_PARAMS.continentCountTarget;

  if (!Number.isInteger(continentCountTarget) || continentCountTarget <= 0) {
    return {
      ok: false,
      error: 'continentCountTarget must be a positive integer.',
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
      landRatio,
      continentCountTarget,
      tectonicStrength,
      coastlineRoughness,
      mountainIntensity,
    },
  };
};

const buildContinentsPipelineConfig = (context: MapGeneratorContext, params: ContinentsParams) => {
  const mapArea = context.width * context.height;
  const majorMasses = Math.max(1, params.continentCountTarget);
  const poissonMinDistance = clamp(
    Math.sqrt(mapArea / Math.max(4, majorMasses * 3.8)) * 0.92,
    2.4,
    Math.max(context.width, context.height),
  );

  return {
    scriptId: CONTINENTS_GENERATOR_ID,
    landRatio: params.landRatio,
    poissonMinDistance,
    poissonAttempts: 26,
    poissonMaxSeeds: Math.max(majorMasses * 10, 24),
    primaryRegionTarget: majorMasses,
    largeMassBias: 0.84,
    fragmentation: 0.12 + params.coastlineRoughness * 0.16,
    chainTendency: 0.34,
    edgeOceanBias: 0.2,
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
      key: 'landRatio',
      label: 'Land Ratio',
      description: 'Total percentage of map that should be land.',
      defaultValue: DEFAULT_PARAMS.landRatio,
      min: 0.15,
      max: 0.55,
      step: 0.01,
    },
    {
      key: 'continentCountTarget',
      label: 'Continent Target',
      description: 'Approximate number of major continental masses.',
      defaultValue: DEFAULT_PARAMS.continentCountTarget,
      min: 1,
      max: 10,
      step: 1,
      integer: true,
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
