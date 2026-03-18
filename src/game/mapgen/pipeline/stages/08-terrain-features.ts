import { canPlaceTerrainFeatureOnTerrain, type TerrainFeatureType } from '/base/terrainFeatures';
import type { TileType } from '/base/tiles';
import { clamp } from '/game/mapgen/helpers';
import type { MapgenPipelineStage, MapgenPipelineState } from '/game/mapgen/pipeline/contracts';
import type { MapGrid } from '/game/mapgen/pipeline/support/grid';
import { sampleIsotropicField } from '/game/mapgen/pipeline/support/isotropic-noise';
import type { MapTile } from '/types/map';

export type TerrainFeatureGenerationConfig = {
  noiseAt: (q: number, r: number, salt?: string) => number;
};

type WeightedFeature = {
  featureId: TerrainFeatureType;
  weight: number;
};

const TERRAIN_FEATURE_TYPES: readonly TerrainFeatureType[] = [
  'forest',
  'jungle',
  'bamboo_grove',
  'reeds',
];
const WATER_TERRAINS = new Set<TileType>(['coastal_sea', 'deep_sea', 'ocean']);

const BASE_DENSITY_BY_TERRAIN: Partial<Record<TileType, number>> = {
  grassland: 0.8,
  plains: 0.5,
  coastal_sea: 0.2,
};

const hasAdjacentWater = (grid: MapGrid, tiles: MapTile[], tileIndex: number): boolean => {
  const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

  for (const neighborIndex of neighbors) {
    if (neighborIndex < 0) {
      continue;
    }

    const neighbor = tiles[neighborIndex];

    if (!neighbor) {
      continue;
    }

    if (WATER_TERRAINS.has(neighbor.terrain)) {
      return true;
    }
  }

  return false;
};

const resolveBaseDensity = (tile: MapTile): number => {
  const terrainDensity = BASE_DENSITY_BY_TERRAIN[tile.terrain] ?? 0;

  if (terrainDensity <= 0) {
    return 0;
  }

  if (tile.elevation === 'mountain') {
    return 0;
  }

  const elevationMultiplier =
    tile.elevation === 'hill' ? 0.74 : tile.elevation === 'underwater' ? 0.9 : 1;

  return clamp(terrainDensity * elevationMultiplier, 0, 1);
};

const sampleTerrainFeatureField = (
  tile: MapTile,
  noiseAt: TerrainFeatureGenerationConfig['noiseAt'],
  salt: string,
): number =>
  sampleIsotropicField(tile.q, tile.r, noiseAt, salt, {
    contrast: 1.12,
    frequency: 0.28,
    warpAmount: 0.45,
  });

const createFeatureWeights = (
  tile: MapTile,
  hasWaterNeighbor: boolean,
  noiseAt: TerrainFeatureGenerationConfig['noiseAt'],
): WeightedFeature[] => {
  const heat = sampleTerrainFeatureField(tile, noiseAt, 'terrain-feature-heat');
  const moisture = sampleTerrainFeatureField(tile, noiseAt, 'terrain-feature-moisture');
  const fertility = sampleTerrainFeatureField(tile, noiseAt, 'terrain-feature-fertility');
  const weights: WeightedFeature[] = [];

  for (const featureId of TERRAIN_FEATURE_TYPES) {
    if (!canPlaceTerrainFeatureOnTerrain(featureId, tile.terrain, tile.elevation)) {
      continue;
    }

    let weight = 0;

    if (featureId === 'forest') {
      if (tile.terrain === 'grassland' || tile.terrain === 'plains') {
        weight = 0.45 + moisture * 0.6 + (tile.elevation === 'hill' ? 0.08 : 0);
      }
    } else if (featureId === 'jungle') {
      if (tile.terrain === 'grassland') {
        weight = clamp(0.1 + (heat - 0.45) * 1.7 + (moisture - 0.42) * 1.9, 0, 1.45);
      }
    } else if (featureId === 'bamboo_grove') {
      if (tile.terrain === 'grassland') {
        weight = clamp(0.2 + moisture * 0.7 + fertility * 0.35 - heat * 0.14, 0, 1.2);
      }
    } else if (featureId === 'reeds') {
      if (tile.terrain === 'coastal_sea') {
        weight = 1.35;
      } else if (tile.terrain === 'grassland' && tile.elevation === 'flat' && hasWaterNeighbor) {
        weight = 0.65 + moisture * 0.4;
      }
    }

    if (weight > 0) {
      weights.push({
        featureId,
        weight,
      });
    }
  }

  return weights;
};

const pickWeightedFeature = (
  weightedFeatures: readonly WeightedFeature[],
  noiseRoll: number,
): TerrainFeatureType | undefined => {
  const totalWeight = weightedFeatures.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    return undefined;
  }

  const threshold = clamp(noiseRoll, 0, 0.999999) * totalWeight;
  let runningWeight = 0;

  for (const entry of weightedFeatures) {
    runningWeight += entry.weight;

    if (threshold <= runningWeight) {
      return entry.featureId;
    }
  }

  return weightedFeatures[weightedFeatures.length - 1]?.featureId;
};

export const assignTerrainFeatures = (
  grid: MapGrid,
  tiles: MapTile[],
  config: TerrainFeatureGenerationConfig,
): MapTile[] => {
  if (tiles.length !== grid.tiles.length) {
    throw new Error('Terrain feature generation requires tile count to match grid tile count.');
  }

  return tiles.map((tile, tileIndex) => {
    const baseDensity = resolveBaseDensity(tile);

    if (baseDensity <= 0) {
      if (!tile.terrainFeatureId) {
        return tile;
      }

      return {
        ...tile,
        terrainFeatureId: undefined,
      };
    }

    const densityNoise = sampleTerrainFeatureField(tile, config.noiseAt, 'terrain-feature-density');
    const threshold = clamp(baseDensity + (densityNoise - 0.5) * 0.14, 0, 1);
    const presenceNoise = sampleTerrainFeatureField(
      tile,
      config.noiseAt,
      'terrain-feature-presence',
    );

    if (presenceNoise > threshold) {
      if (!tile.terrainFeatureId) {
        return tile;
      }

      return {
        ...tile,
        terrainFeatureId: undefined,
      };
    }

    const weightedFeatures = createFeatureWeights(
      tile,
      hasAdjacentWater(grid, tiles, tileIndex),
      config.noiseAt,
    );
    const selectedFeature = pickWeightedFeature(
      weightedFeatures,
      sampleTerrainFeatureField(tile, config.noiseAt, 'terrain-feature-type'),
    );

    if (!selectedFeature) {
      if (!tile.terrainFeatureId) {
        return tile;
      }

      return {
        ...tile,
        terrainFeatureId: undefined,
      };
    }

    return {
      ...tile,
      terrainFeatureId: selectedFeature,
    };
  });
};

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<Pick<MapgenPipelineState, 'grid' | 'sprayedTiles' | 'subseeds'>> => {
  if (!state.grid || !state.sprayedTiles || !state.subseeds) {
    throw new Error('Terrain feature stage requires sprayed tile output.');
  }

  return state as MapgenPipelineState &
    Required<Pick<MapgenPipelineState, 'grid' | 'sprayedTiles' | 'subseeds'>>;
};

export const terrainFeaturesStage: MapgenPipelineStage = {
  id: '08-terrain-features',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      tiles: assignTerrainFeatures(nextState.grid, nextState.sprayedTiles, {
        noiseAt: (q, r, salt) => nextState.subseeds.noiseAt('terrain-features', q, r, salt),
      }),
    };
  },
};
