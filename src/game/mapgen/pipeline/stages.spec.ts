import { createRectCoords } from '/game/mapgen/helpers';
import { createSeededRandom } from '/game/mapgen/random';
import { applyDetailPass } from '/game/mapgen/pipeline/stages/05-detail-noise';
import { applyElevationSpray } from '/game/mapgen/pipeline/stages/07-elevation-spray';
import { createMapGrid } from '/game/mapgen/pipeline/support/grid';
import { buildMacroLandMask } from '/game/mapgen/pipeline/stages/03-land-mask';
import { generatePoissonSeeds } from '/game/mapgen/pipeline/support/poisson';
import { applyTectonicPass } from '/game/mapgen/pipeline/stages/04-tectonics';
import { classifyTerrain } from '/game/mapgen/pipeline/stages/06-terrain-classification';
import { assignTerrainFeatures } from '/game/mapgen/pipeline/stages/08-terrain-features';
import { assignVoronoiRegions } from '/game/mapgen/pipeline/support/voronoi';
import { hashNoiseAt } from '/game/mapgen/random';
import { canPlaceTerrainFeatureOnTerrain } from '/base/terrainFeatures';

const ALLOWED_TERRAINS = new Set([
  'ocean',
  'deep_sea',
  'coastal_sea',
  'grassland',
  'plains',
  'desert',
  'tundra',
]);
const ALLOWED_ELEVATIONS = new Set(['underwater', 'flat', 'hill', 'mountain']);
const ALLOWED_TERRAIN_FEATURES = new Set(['forest', 'jungle', 'bamboo_grove', 'reeds']);

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

    const result = buildMacroLandMask(grid, voronoi, {
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
    const macroMask = buildMacroLandMask(grid, voronoi, {
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
    const macroMask = buildMacroLandMask(grid, voronoi, {
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
      expect(ALLOWED_ELEVATIONS.has(tile.elevation)).toBe(true);
    }
  });

  it('assigns deterministic terrain features as a separate tile layer', () => {
    const grid = createMapGrid(24, 20, () => createRectCoords(24, 20));
    const seeds = generatePoissonSeeds({
      width: 24,
      height: 20,
      minDistance: 2.8,
      random: createSeededRandom('feature-seeds'),
      maxPoints: 34,
    });
    const voronoi = assignVoronoiRegions(grid, seeds);
    const macroMask = buildMacroLandMask(grid, voronoi, {
      landRatio: 0.34,
      primaryRegionTarget: 3,
      largeMassBias: 0.68,
      fragmentation: 0.27,
      chainTendency: 0.36,
      edgeOceanBias: 0.22,
      random: createSeededRandom('feature-macro'),
      noiseAt: createNoiseAt('feature-macro-noise'),
    });
    const tectonics = applyTectonicPass(grid, voronoi, macroMask.landMask, {
      strength: 0.6,
      random: createSeededRandom('feature-tectonics'),
      noiseAt: createNoiseAt('feature-tectonics-noise'),
    });
    const detail = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
      coastlineRoughness: 0.57,
      targetLandRatio: 0.34,
      random: createSeededRandom('feature-detail'),
      noiseAt: createNoiseAt('feature-detail-noise'),
      regionScoreByTile: macroMask.regionScoreByTile,
    });
    const classified = classifyTerrain(grid, detail.landMask, detail.elevation, {
      shelfWidth: 2,
      mountainIntensity: 0.58,
      noiseAt: createNoiseAt('feature-terrain-noise'),
    });
    const sprayed = applyElevationSpray(grid, classified.tiles, {
      density: 0.9,
      random: createSeededRandom('feature-spray-noise'),
    });

    const first = assignTerrainFeatures(grid, sprayed, {
      noiseAt: createNoiseAt('feature-pass-noise'),
    });
    const second = assignTerrainFeatures(grid, sprayed, {
      noiseAt: createNoiseAt('feature-pass-noise'),
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(classified.tiles.length);

    let assignedFeatureCount = 0;

    for (let index = 0; index < first.length; index += 1) {
      const baseTile = sprayed[index];
      const tile = first[index];

      expect(tile?.terrain).toBe(baseTile?.terrain);
      expect(tile?.elevation).toBe(baseTile?.elevation);

      if (!tile?.terrainFeatureId) {
        continue;
      }

      assignedFeatureCount += 1;
      expect(ALLOWED_TERRAIN_FEATURES.has(tile.terrainFeatureId)).toBe(true);
      expect(
        canPlaceTerrainFeatureOnTerrain(tile.terrainFeatureId, tile.terrain, tile.elevation),
      ).toBe(true);
    }

    expect(assignedFeatureCount).toBeGreaterThan(0);
  });
});
