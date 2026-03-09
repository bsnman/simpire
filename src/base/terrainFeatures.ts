import type { ProductionType } from '~/base/productions';
import type { TileType } from '~/base/tiles';

export type TerrainFeature = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  bonusProduction?: { [key in ProductionType]?: number };
  allowedTerrains: TileType[];
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
    allowedTerrains: ['grassland', 'plains', 'hill'] as TileType[],
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
    allowedTerrains: ['grassland', 'hill'] as TileType[],
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
  },
} satisfies Record<string, TerrainFeature>;

export type TerrainFeatureType = keyof typeof terrainFeatures;

export const canPlaceTerrainFeatureOnTerrain = (
  terrainFeatureType: TerrainFeatureType,
  terrain: TileType,
): boolean => terrainFeatures[terrainFeatureType].allowedTerrains.includes(terrain);
