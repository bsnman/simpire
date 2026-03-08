import type { ProductionType } from '~/base/productions';
import type { TileType } from '~/base/tiles';

export type Resource = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  bonusProduction?: { [key in ProductionType]?: number };
  allowedTerrains: TileType[];
};

export const resources = {
  forest: {
    type: 'forest',
    name: 'Forest',
    description: 'Dense woodland that can only grow on grassland terrain.',
    image: null,
    color: '#2F6A3B',
    bonusProduction: {
      food: 1,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['grassland'] as TileType[],
  },
} satisfies Record<string, Resource>;

export type ResourceType = keyof typeof resources;

export const canPlaceResourceOnTerrain = (resourceType: ResourceType, terrain: TileType): boolean =>
  resources[resourceType].allowedTerrains.includes(terrain);
