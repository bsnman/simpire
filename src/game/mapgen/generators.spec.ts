import {
  ARCHIPELAGO_GENERATOR_ID,
  CONTINENTS_GENERATOR_ID,
  generateMap,
  getMapGenerator,
  listMapGenerators,
} from '~/game/mapgen';
import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import { buildLandMaskFromTiles, calculateMapQualityMetrics } from '~/game/mapgen/pipeline/metrics';
import type { MapTile } from '~/types/map';

const WIDTH = 44;
const HEIGHT = 30;

const toTileArray = (map: ReturnType<typeof generateMap>): MapTile[] =>
  map.tileKeys.map((key) => map.tilesByKey[key]).filter((tile): tile is MapTile => Boolean(tile));

const buildMetrics = (map: ReturnType<typeof generateMap>) => {
  const grid = createMapGrid(WIDTH, HEIGHT, () => createRectCoords(WIDTH, HEIGHT));
  const landMask = buildLandMaskFromTiles(grid, toTileArray(map));
  return calculateMapQualityMetrics(grid, landMask);
};

const countTerrains = (map: ReturnType<typeof generateMap>) => {
  const counts = new Map<MapTile['terrain'], number>();

  for (const key of map.tileKeys) {
    const tile = map.tilesByKey[key];

    if (!tile) {
      continue;
    }

    counts.set(tile.terrain, (counts.get(tile.terrain) ?? 0) + 1);
  }

  return counts;
};

const terrainDifferenceRatio = (
  left: ReturnType<typeof generateMap>,
  right: ReturnType<typeof generateMap>,
): number => {
  let changed = 0;

  for (const key of left.tileKeys) {
    const leftTile = left.tilesByKey[key];
    const rightTile = right.tilesByKey[key];

    if (!leftTile || !rightTile) {
      continue;
    }

    if (leftTile.terrain !== rightTile.terrain) {
      changed += 1;
    }
  }

  return left.tileKeys.length > 0 ? changed / left.tileKeys.length : 0;
};

describe('map generators', () => {
  it('keeps existing built-in IDs available in registry', () => {
    const ids = listMapGenerators();

    expect(ids).toContain(CONTINENTS_GENERATOR_ID);
    expect(ids).toContain(ARCHIPELAGO_GENERATOR_ID);
  });

  it('is deterministic for identical seed and params', () => {
    const request = {
      algorithmId: CONTINENTS_GENERATOR_ID,
      width: WIDTH,
      height: HEIGHT,
      seedHash: 'determinism-seed-1',
      params: {
        landRatio: 0.33,
        continentCountTarget: 3,
        tectonicStrength: 0.64,
        coastlineRoughness: 0.59,
        mountainIntensity: 0.57,
      },
    };

    const first = generateMap(request);
    const second = generateMap(request);

    expect(first).toEqual(second);
  });

  it('produces measurable variation when seed changes', () => {
    const first = generateMap({
      algorithmId: CONTINENTS_GENERATOR_ID,
      width: WIDTH,
      height: HEIGHT,
      seedHash: 'variation-seed-a',
      params: {
        landRatio: 0.31,
        continentCountTarget: 2,
        tectonicStrength: 0.6,
        coastlineRoughness: 0.58,
        mountainIntensity: 0.6,
      },
    });

    const second = generateMap({
      algorithmId: CONTINENTS_GENERATOR_ID,
      width: WIDTH,
      height: HEIGHT,
      seedHash: 'variation-seed-b',
      params: {
        landRatio: 0.31,
        continentCountTarget: 2,
        tectonicStrength: 0.6,
        coastlineRoughness: 0.58,
        mountainIntensity: 0.6,
      },
    });

    expect(terrainDifferenceRatio(first, second)).toBeGreaterThan(0.08);
  });

  it('keeps land ratio close to requested targets for both scripts', () => {
    const scenarios = [
      {
        algorithmId: CONTINENTS_GENERATOR_ID,
        targetRatio: 0.34,
        params: {
          landRatio: 0.34,
          continentCountTarget: 3,
          tectonicStrength: 0.63,
          coastlineRoughness: 0.56,
          mountainIntensity: 0.55,
        },
      },
      {
        algorithmId: ARCHIPELAGO_GENERATOR_ID,
        targetRatio: 0.24,
        params: {
          landRatio: 0.24,
          islandSizeBias: 0.32,
          chainTendency: 0.68,
          shelfWidth: 2,
          tectonicStrength: 0.52,
        },
      },
    ] as const;

    for (const scenario of scenarios) {
      for (let index = 0; index < 5; index += 1) {
        const map = generateMap({
          algorithmId: scenario.algorithmId,
          width: WIDTH,
          height: HEIGHT,
          seedHash: `${scenario.algorithmId}-ratio-${index}`,
          params: scenario.params,
        });

        const metrics = buildMetrics(map);
        expect(Math.abs(metrics.landRatio - scenario.targetRatio)).toBeLessThanOrEqual(0.03);
      }
    }
  });

  it('creates distinct macro profiles for continents vs archipelago', () => {
    const sampleSeeds = Array.from({ length: 6 }, (_, index) => `profile-seed-${index}`);

    const continentsShares = sampleSeeds.map((seed) => {
      const map = generateMap({
        algorithmId: CONTINENTS_GENERATOR_ID,
        width: WIDTH,
        height: HEIGHT,
        seedHash: `${seed}-c`,
        params: {
          landRatio: 0.33,
          continentCountTarget: 3,
          tectonicStrength: 0.63,
          coastlineRoughness: 0.57,
          mountainIntensity: 0.58,
        },
      });

      return buildMetrics(map).largestLandmassShare;
    });

    const archipelagoShares = sampleSeeds.map((seed) => {
      const map = generateMap({
        algorithmId: ARCHIPELAGO_GENERATOR_ID,
        width: WIDTH,
        height: HEIGHT,
        seedHash: `${seed}-a`,
        params: {
          landRatio: 0.24,
          islandSizeBias: 0.28,
          chainTendency: 0.7,
          shelfWidth: 2,
          tectonicStrength: 0.51,
        },
      });

      return buildMetrics(map).largestLandmassShare;
    });

    const averageContinentsShare =
      continentsShares.reduce((sum, value) => sum + value, 0) / continentsShares.length;
    const averageArchipelagoShare =
      archipelagoShares.reduce((sum, value) => sum + value, 0) / archipelagoShares.length;

    expect(averageContinentsShare).toBeGreaterThan(averageArchipelagoShare + 0.12);
  });

  it('preserves lowland terrain presence across deterministic seed sweeps', () => {
    const scenarios = [
      {
        algorithmId: CONTINENTS_GENERATOR_ID,
        params: {
          landRatio: 0.33,
          continentCountTarget: 3,
          tectonicStrength: 0.62,
          coastlineRoughness: 0.57,
          mountainIntensity: 0.58,
        },
      },
      {
        algorithmId: ARCHIPELAGO_GENERATOR_ID,
        params: {
          landRatio: 0.24,
          islandSizeBias: 0.3,
          chainTendency: 0.7,
          shelfWidth: 2,
          tectonicStrength: 0.52,
        },
      },
    ] as const;

    const sampleSeeds = Array.from({ length: 12 }, (_, index) => `terrain-profile-seed-${index}`);

    for (const scenario of scenarios) {
      let aggregateLand = 0;
      let aggregateLowland = 0;
      let aggregateMountain = 0;
      let aggregateGrassland = 0;
      let aggregatePlains = 0;

      for (const seed of sampleSeeds) {
        const map = generateMap({
          algorithmId: scenario.algorithmId,
          width: WIDTH,
          height: HEIGHT,
          seedHash: `${scenario.algorithmId}-${seed}`,
          params: scenario.params,
        });

        const counts = countTerrains(map);
        const grassland = counts.get('grassland') ?? 0;
        const plains = counts.get('plains') ?? 0;
        const hill = counts.get('hill') ?? 0;
        const mountain = counts.get('mountain') ?? 0;
        const land = grassland + plains + hill + mountain;
        const lowland = grassland + plains;

        expect(lowland).toBeGreaterThan(0);
        expect(mountain).toBeGreaterThan(0);

        aggregateLand += land;
        aggregateLowland += lowland;
        aggregateMountain += mountain;
        aggregateGrassland += grassland;
        aggregatePlains += plains;
      }

      const lowlandShare = aggregateLowland / aggregateLand;
      const mountainShare = aggregateMountain / aggregateLand;
      const grassToPlainsRatio = aggregateGrassland / Math.max(1, aggregatePlains);

      expect(lowlandShare).toBeGreaterThan(0.15);
      expect(mountainShare).toBeLessThan(0.45);
      expect(grassToPlainsRatio).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('supports legacy parameter shapes for backward compatibility', () => {
    expect(() =>
      generateMap({
        algorithmId: CONTINENTS_GENERATOR_ID,
        width: WIDTH,
        height: HEIGHT,
        seedHash: 'legacy-continents',
        params: {
          seaLevelPercent: 68,
          continentCount: 2,
        },
      }),
    ).not.toThrow();

    expect(() =>
      generateMap({
        algorithmId: ARCHIPELAGO_GENERATOR_ID,
        width: WIDTH,
        height: HEIGHT,
        seedHash: 'legacy-archipelago',
        params: {
          seaLevelPercent: 78,
          islandDensity: 0.2,
        },
      }),
    ).not.toThrow();
  });

  it('exposes parameter metadata for dynamic Create Game controls', () => {
    const continents = getMapGenerator(CONTINENTS_GENERATOR_ID);
    const archipelago = getMapGenerator(ARCHIPELAGO_GENERATOR_ID);

    expect(continents?.parameterDefinitions?.length).toBeGreaterThanOrEqual(5);
    expect(archipelago?.parameterDefinitions?.length).toBeGreaterThanOrEqual(5);

    expect(continents?.parameterDefinitions?.some((entry) => entry.key === 'landRatio')).toBe(true);
    expect(archipelago?.parameterDefinitions?.some((entry) => entry.key === 'islandSizeBias')).toBe(
      true,
    );
  });
});
