import { clamp } from '~/game/mapgen/helpers';
import {
  type MapGeneratorContext,
  type MapGeneratorDefinition,
  type ValidationResult,
} from '~/game/mapgen/contracts';
import { runGeneratorPipeline } from '~/game/mapgen/pipeline/run';

export const ARCHIPELAGO_GENERATOR_ID = 'archipelago';

export type ArchipelagoParams = {
  landRatio: number;
  islandSizeBias: number;
  chainTendency: number;
  shelfWidth: number;
  tectonicStrength: number;
};

type LegacyArchipelagoParams = {
  seaLevelPercent?: number;
  islandDensity?: number;
};

const DEFAULT_PARAMS: ArchipelagoParams = {
  landRatio: 0.24,
  islandSizeBias: 0.36,
  chainTendency: 0.64,
  shelfWidth: 2,
  tectonicStrength: 0.52,
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

const normalizeIslandSizeBias = (record: Record<string, unknown>): number | undefined => {
  const explicitSizeBias = readFiniteNumber(record, 'islandSizeBias');

  if (typeof explicitSizeBias === 'number') {
    return explicitSizeBias;
  }

  const legacyDensity = readFiniteNumber(record as LegacyArchipelagoParams, 'islandDensity');

  if (typeof legacyDensity === 'number') {
    return clamp(1 - legacyDensity, 0, 1);
  }

  return undefined;
};

const validateArchipelagoParams = (params: unknown): ValidationResult<ArchipelagoParams> => {
  if (!isRecord(params)) {
    return {
      ok: false,
      error:
        'Params must be an object with landRatio, islandSizeBias, chainTendency, shelfWidth, and tectonicStrength.',
    };
  }

  const landRatio = normalizeLandRatio(params) ?? DEFAULT_PARAMS.landRatio;

  if (landRatio < 0 || landRatio > 1) {
    return {
      ok: false,
      error: 'landRatio must be in the range 0..1 (or provide seaLevelPercent in 0..100).',
    };
  }

  const islandSizeBias = normalizeIslandSizeBias(params) ?? DEFAULT_PARAMS.islandSizeBias;

  if (islandSizeBias < 0 || islandSizeBias > 1) {
    return {
      ok: false,
      error: 'islandSizeBias must be in the range 0..1.',
    };
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

  return {
    ok: true,
    value: {
      landRatio,
      islandSizeBias,
      chainTendency,
      shelfWidth,
      tectonicStrength,
    },
  };
};

const buildArchipelagoPipelineConfig = (
  context: MapGeneratorContext,
  params: ArchipelagoParams,
) => {
  const mapArea = context.width * context.height;
  const islandScale = clamp(params.islandSizeBias, 0, 1);
  const regionFactor = 10 + (1 - islandScale) * 26;
  const poissonMinDistance = clamp(
    Math.sqrt(mapArea / regionFactor) * 0.78,
    2,
    Math.max(context.width, context.height),
  );

  return {
    scriptId: ARCHIPELAGO_GENERATOR_ID,
    landRatio: params.landRatio,
    poissonMinDistance,
    poissonAttempts: 30,
    poissonMaxSeeds: Math.max(30, Math.round(regionFactor * 2.2)),
    primaryRegionTarget: Math.max(4, Math.round(6 + (1 - islandScale) * 8)),
    largeMassBias: 0.28 + islandScale * 0.2,
    fragmentation: 0.44 + (1 - islandScale) * 0.32,
    chainTendency: params.chainTendency,
    edgeOceanBias: 0.36,
    tectonicStrength: params.tectonicStrength,
    coastlineRoughness: 0.74,
    mountainIntensity: clamp(0.42 + params.tectonicStrength * 0.25, 0, 1),
    shelfWidth: params.shelfWidth,
  };
};

export const archipelagoMapGenerator: MapGeneratorDefinition<ArchipelagoParams> = {
  id: ARCHIPELAGO_GENERATOR_ID,
  displayName: 'Archipelago',
  description: 'Fragmented island groups with chain-biased macro shaping.',
  parameterDefinitions: [
    {
      key: 'landRatio',
      label: 'Land Ratio',
      description: 'Total percentage of map that should be land.',
      defaultValue: DEFAULT_PARAMS.landRatio,
      min: 0.1,
      max: 0.45,
      step: 0.01,
    },
    {
      key: 'islandSizeBias',
      label: 'Island Size Bias',
      description: 'Lower values favor smaller islands and denser fragmentation.',
      defaultValue: DEFAULT_PARAMS.islandSizeBias,
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
  ],
  validateParams: validateArchipelagoParams,
  generateTiles: (context, params) =>
    runGeneratorPipeline(context, buildArchipelagoPipelineConfig(context, params)).tiles,
};
