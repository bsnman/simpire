import { createRectCoords } from '~/game/mapgen/helpers';
import { createSeededRandom } from '~/game/mapgen/random';
import { applyDetailPass } from '~/game/mapgen/pipeline/detail-noise';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import { buildMacroMask } from '~/game/mapgen/pipeline/macro-mask';
import { generatePoissonSeeds } from '~/game/mapgen/pipeline/poisson';
import { applyTectonicPass } from '~/game/mapgen/pipeline/tectonics';
import { classifyTerrain } from '~/game/mapgen/pipeline/terrain-classify';
import { assignVoronoiRegions } from '~/game/mapgen/pipeline/voronoi';
import { hashNoiseAt } from '~/game/mapgen/random';

const ALLOWED_TERRAINS = new Set([
  'ocean',
  'deep_sea',
  'coastal_sea',
  'grassland',
  'plains',
  'hill',
  'mountain',
]);

const createNoiseAt = (seed: string) => (q: number, r: number, salt?: string) =>
  hashNoiseAt(seed, q, r, salt);

const toRatio = (landMask: ArrayLike<number>): number => {
  const landTiles = Array.from(landMask).reduce(
    (count, value) => (value > 0 ? count + 1 : count),
    0,
  );
  return landMask.length > 0 ? landTiles / landMask.length : 0;
};

describe('mapgen pipeline stages', () => {
  it('keeps macro land ratio near target with deterministic region assignment', () => {
    const grid = createMapGrid(36, 26, () => createRectCoords(36, 26));
    const random = createSeededRandom('macro-ratio-seed');
    const seeds = generatePoissonSeeds({
      width: 36,
      height: 26,
      minDistance: 3.1,
      random,
      maxPoints: 60,
    });
    const voronoi = assignVoronoiRegions(grid, seeds);

    const result = buildMacroMask(grid, voronoi, {
      landRatio: 0.34,
      primaryRegionTarget: 4,
      largeMassBias: 0.7,
      fragmentation: 0.25,
      chainTendency: 0.4,
      edgeOceanBias: 0.2,
      random: createSeededRandom('macro-pass-random'),
      noiseAt: createNoiseAt('macro-noise-seed'),
    });

    expect(result.landMask.length).toBe(grid.tiles.length);
    expect(Math.abs(toRatio(result.landMask) - 0.34)).toBeLessThanOrEqual(0.02);
  });

  it('produces bounded deterministic tectonic and detail fields', () => {
    const grid = createMapGrid(32, 24, () => createRectCoords(32, 24));
    const seeds = generatePoissonSeeds({
      width: 32,
      height: 24,
      minDistance: 3,
      random: createSeededRandom('tectonic-seeds'),
      maxPoints: 50,
    });
    const voronoi = assignVoronoiRegions(grid, seeds);
    const macroMask = buildMacroMask(grid, voronoi, {
      landRatio: 0.31,
      primaryRegionTarget: 3,
      largeMassBias: 0.75,
      fragmentation: 0.2,
      chainTendency: 0.35,
      edgeOceanBias: 0.25,
      random: createSeededRandom('macro-b'),
      noiseAt: createNoiseAt('macro-b-noise'),
    });

    const tectonics = applyTectonicPass(grid, voronoi, macroMask.landMask, {
      strength: 0.62,
      random: createSeededRandom('tectonic-pass'),
      noiseAt: createNoiseAt('tectonic-noise'),
    });

    expect(Math.min(...tectonics.elevation)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...tectonics.elevation)).toBeLessThanOrEqual(1);

    const detailA = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
      coastlineRoughness: 0.6,
      targetLandRatio: 0.31,
      random: createSeededRandom('detail-pass-seed'),
      noiseAt: createNoiseAt('detail-noise-seed'),
      regionScoreByTile: macroMask.regionScoreByTile,
    });

    const detailB = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
      coastlineRoughness: 0.6,
      targetLandRatio: 0.31,
      random: createSeededRandom('detail-pass-seed'),
      noiseAt: createNoiseAt('detail-noise-seed'),
      regionScoreByTile: macroMask.regionScoreByTile,
    });

    expect(Array.from(detailA.landMask)).toEqual(Array.from(detailB.landMask));
    expect(Array.from(detailA.elevation)).toEqual(Array.from(detailB.elevation));
    expect(Math.min(...detailA.elevation)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...detailA.elevation)).toBeLessThanOrEqual(1);
  });

  it('classifies terrain into supported terrain IDs only', () => {
    const grid = createMapGrid(22, 18, () => createRectCoords(22, 18));
    const seeds = generatePoissonSeeds({
      width: 22,
      height: 18,
      minDistance: 2.8,
      random: createSeededRandom('classify-seeds'),
      maxPoints: 30,
    });
    const voronoi = assignVoronoiRegions(grid, seeds);
    const macroMask = buildMacroMask(grid, voronoi, {
      landRatio: 0.33,
      primaryRegionTarget: 3,
      largeMassBias: 0.7,
      fragmentation: 0.25,
      chainTendency: 0.38,
      edgeOceanBias: 0.2,
      random: createSeededRandom('classify-macro'),
      noiseAt: createNoiseAt('classify-noise'),
    });
    const tectonics = applyTectonicPass(grid, voronoi, macroMask.landMask, {
      strength: 0.58,
      random: createSeededRandom('classify-tectonics'),
      noiseAt: createNoiseAt('classify-tectonics-noise'),
    });

    const detail = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
      coastlineRoughness: 0.55,
      targetLandRatio: 0.33,
      random: createSeededRandom('classify-detail'),
      noiseAt: createNoiseAt('classify-detail-noise'),
      regionScoreByTile: macroMask.regionScoreByTile,
    });

    const classified = classifyTerrain(grid, detail.landMask, detail.elevation, {
      shelfWidth: 2,
      mountainIntensity: 0.6,
      noiseAt: createNoiseAt('classify-terrain-noise'),
    });

    expect(classified.tiles).toHaveLength(grid.tiles.length);

    for (const tile of classified.tiles) {
      expect(ALLOWED_TERRAINS.has(tile.terrain)).toBe(true);
    }
  });
});
