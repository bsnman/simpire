import { clamp } from '~/game/mapgen/helpers';
import type { MapGeneratorContext } from '~/game/mapgen/contracts';
import { classifyTerrain } from '~/game/mapgen/pipeline/terrain-classify';
import { applyDetailPass } from '~/game/mapgen/pipeline/detail-noise';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import { buildMacroMask } from '~/game/mapgen/pipeline/macro-mask';
import { calculateMapQualityMetrics, type MapQualityMetrics } from '~/game/mapgen/pipeline/metrics';
import { generatePoissonSeeds } from '~/game/mapgen/pipeline/poisson';
import { createSubseedStreams } from '~/game/mapgen/pipeline/subseeds';
import { applyTectonicPass } from '~/game/mapgen/pipeline/tectonics';
import { assignVoronoiRegions } from '~/game/mapgen/pipeline/voronoi';
import type { MapTile } from '~/types/map';

export type GeneratorPipelineConfig = {
  scriptId: string;
  landRatio: number;
  poissonMinDistance: number;
  poissonAttempts?: number;
  poissonMaxSeeds?: number;
  primaryRegionTarget: number;
  primaryRegionTargetMin?: number;
  primaryRegionTargetMax?: number;
  largeMassBias: number;
  fragmentation: number;
  chainTendency: number;
  edgeOceanBias: number;
  tectonicStrength: number;
  coastlineRoughness: number;
  mountainIntensity: number;
  shelfWidth: number;
};

export type GeneratorPipelineResult = {
  tiles: MapTile[];
  metrics: MapQualityMetrics;
  debug: {
    seedCount: number;
    regionCount: number;
    targetLandRatio: number;
    actualLandRatio: number;
  };
};

const resolvePrimaryRegionTarget = (
  config: Pick<
    GeneratorPipelineConfig,
    'primaryRegionTarget' | 'primaryRegionTargetMin' | 'primaryRegionTargetMax'
  >,
  random: { int: (min: number, max: number) => number },
): number => {
  const fallback = Math.max(1, Math.round(config.primaryRegionTarget));
  const min = Math.max(1, Math.round(config.primaryRegionTargetMin ?? fallback));
  const max = Math.max(min, Math.round(config.primaryRegionTargetMax ?? min));

  if (min === max) {
    return min;
  }

  return random.int(min, max + 1);
};

const ensureMinimumSeedCoverage = (
  seeds: { id: number; col: number; row: number }[],
  width: number,
  height: number,
  minimumSeedCount: number,
  random: { next: () => number },
) => {
  const nextSeeds = [...seeds];

  while (nextSeeds.length < minimumSeedCount) {
    nextSeeds.push({
      id: nextSeeds.length,
      col: random.next() * width,
      row: random.next() * height,
    });
  }

  return nextSeeds;
};

export const runGeneratorPipeline = (
  context: MapGeneratorContext,
  config: GeneratorPipelineConfig,
): GeneratorPipelineResult => {
  const grid = createMapGrid(context.width, context.height, context.createRectCoords);

  if (!grid.tiles.length) {
    return {
      tiles: [],
      metrics: {
        landRatio: 0,
        landTileCount: 0,
        waterTileCount: 0,
        landmassCount: 0,
        largestLandmassShare: 0,
        coastlineComplexity: 0,
        directionalityScore: 0,
        dominantAxis: 0,
      },
      debug: {
        seedCount: 0,
        regionCount: 0,
        targetLandRatio: 0,
        actualLandRatio: 0,
      },
    };
  }

  const subseeds = createSubseedStreams(context);
  const macroRandom = subseeds.random('macro');
  const clampedLandRatio = clamp(config.landRatio, 0, 1);
  const primaryRegionTarget = resolvePrimaryRegionTarget(config, macroRandom);
  const minDistance = Math.max(2, config.poissonMinDistance);
  const initialSeeds = generatePoissonSeeds({
    width: context.width,
    height: context.height,
    minDistance,
    maxAttempts: config.poissonAttempts,
    maxPoints: config.poissonMaxSeeds,
    random: macroRandom,
  });

  const minimumSeedCount = Math.max(3, Math.min(grid.tiles.length, primaryRegionTarget + 2));
  const seeds = ensureMinimumSeedCoverage(
    initialSeeds,
    context.width,
    context.height,
    minimumSeedCount,
    macroRandom,
  );
  const voronoi = assignVoronoiRegions(grid, seeds);

  const macroMask = buildMacroMask(grid, voronoi, {
    landRatio: clampedLandRatio,
    primaryRegionTarget,
    largeMassBias: config.largeMassBias,
    fragmentation: config.fragmentation,
    chainTendency: config.chainTendency,
    edgeOceanBias: config.edgeOceanBias,
    random: subseeds.random('macro'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('macro', q, r, salt),
  });

  const tectonics = applyTectonicPass(grid, voronoi, macroMask.landMask, {
    strength: config.tectonicStrength,
    random: subseeds.random('elevation'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('elevation', q, r, salt),
  });

  const detailPass = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
    coastlineRoughness: config.coastlineRoughness,
    targetLandRatio: clampedLandRatio,
    random: subseeds.random('detail'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('detail', q, r, salt),
    regionScoreByTile: macroMask.regionScoreByTile,
  });

  const terrain = classifyTerrain(grid, detailPass.landMask, detailPass.elevation, {
    shelfWidth: config.shelfWidth,
    mountainIntensity: config.mountainIntensity,
    noiseAt: (q, r, salt) => subseeds.noiseAt('climate', q, r, salt),
  });

  const metrics = calculateMapQualityMetrics(grid, detailPass.landMask);

  return {
    tiles: terrain.tiles,
    metrics,
    debug: {
      seedCount: seeds.length,
      regionCount: voronoi.regions.length,
      targetLandRatio: clampedLandRatio,
      actualLandRatio: metrics.landRatio,
    },
  };
};
