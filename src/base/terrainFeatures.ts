import type { ProductionType } from '~/base/productions';
import type { ElevationType } from '~/base/elevation';
import type { TileType } from '~/base/tiles';

export type TerrainFeature = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  bonusProduction?: { [key in ProductionType]?: number };
  allowedTerrains: TileType[];
  allowedElevations: ElevationType[];
};

export const terrainFeatures = {
  forest: {
    type: 'forest',
    name: 'Forest',
    description: 'Dense woodland cover on fertile land.',
    image: null,
    color: '#2F6A3B',
    bonusProduction: {
      food: 1,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['grassland', 'plains'] as TileType[],
    allowedElevations: ['flat', 'hill'] as ElevationType[],
  },
  jungle: {
    type: 'jungle',
    name: 'Jungle',
    description: 'Thick tropical vegetation with rich biodiversity.',
    image: null,
    color: '#1E5A2A',
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
    allowedTerrains: ['grassland'] as TileType[],
    allowedElevations: ['flat', 'hill'] as ElevationType[],
  },
  bamboo_grove: {
    type: 'bamboo_grove',
    name: 'Bamboo Grove',
    description: 'Fast-growing bamboo stands that support light construction.',
    image: null,
    color: '#4F8D43',
    bonusProduction: {
      food: 1,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['grassland'] as TileType[],
    allowedElevations: ['flat', 'hill'] as ElevationType[],
  },
  reeds: {
    type: 'reeds',
    name: 'Reeds',
    description: 'Wetland vegetation near shallow water margins.',
    image: null,
    color: '#7BA34B',
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['coastal_sea', 'grassland'] as TileType[],
    allowedElevations: ['underwater', 'flat'] as ElevationType[],
  },
} satisfies Record<string, TerrainFeature>;

export type TerrainFeatureType = keyof typeof terrainFeatures;

export const canPlaceTerrainFeatureOnTerrain = (
  terrainFeatureType: TerrainFeatureType,
  terrain: TileType,
  elevation: ElevationType = 'flat',
): boolean => {
  const terrainFeature = terrainFeatures[terrainFeatureType];
  const hasTerrainRules = terrainFeature.allowedTerrains.length > 0;
  const hasElevationRules = terrainFeature.allowedElevations.length > 0;
  const terrainAllowed = terrainFeature.allowedTerrains.includes(terrain);
  const elevationAllowed = terrainFeature.allowedElevations.includes(elevation);

  if (!hasTerrainRules && !hasElevationRules) {
    return false;
  }

  return (hasTerrainRules && terrainAllowed) || (hasElevationRules && elevationAllowed);
};
