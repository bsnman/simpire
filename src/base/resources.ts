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
  iron_ore: {
    type: 'iron_ore',
    name: 'Iron Ore',
    description: 'Strategic metal deposit used for advanced military and industrial production.',
    image: null,
    color: '#6B7280',
    bonusProduction: {
      food: 0,
      hammer: 2,
      gold: 0,
    },
    allowedTerrains: ['hill', 'mountain'] as TileType[],
  },
  gold_ore: {
    type: 'gold_ore',
    name: 'Gold Ore',
    description: 'Precious mineral vein that increases wealth output.',
    image: null,
    color: '#D4AF37',
    bonusProduction: {
      food: 0,
      hammer: 0,
      gold: 3,
    },
    allowedTerrains: ['hill', 'mountain'] as TileType[],
  },
  bronze_ore: {
    type: 'bronze_ore',
    name: 'Bronze Ore',
    description: 'Useful metal source for early-to-mid production chains.',
    image: null,
    color: '#B87333',
    bonusProduction: {
      food: 0,
      hammer: 1,
      gold: 1,
    },
    allowedTerrains: ['hill', 'plains'] as TileType[],
  },
  fish: {
    type: 'fish',
    name: 'Fish',
    description: 'Abundant marine food source in sea tiles.',
    image: null,
    color: '#5DADE2',
    bonusProduction: {
      food: 2,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['coastal_sea', 'deep_sea'] as TileType[],
  },
  crab: {
    type: 'crab',
    name: 'Crab',
    description: 'Valuable coastal shellfish that improves food and trade value.',
    image: null,
    color: '#D98880',
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
    allowedTerrains: ['coastal_sea'] as TileType[],
  },
  wheat: {
    type: 'wheat',
    name: 'Wheat',
    description: 'Farm staple crop that boosts food production on fertile land.',
    image: null,
    color: '#EAC117',
    bonusProduction: {
      food: 2,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['grassland', 'plains'] as TileType[],
  },
  rice: {
    type: 'rice',
    name: 'Rice',
    description: 'Water-intensive crop suited to fertile lowland terrain.',
    image: null,
    color: '#C9DA2A',
    bonusProduction: {
      food: 2,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['grassland'] as TileType[],
  },
  gems: {
    type: 'gems',
    name: 'Gems',
    description: 'Luxury mineral deposit with strong economic value.',
    image: null,
    color: '#7D3C98',
    bonusProduction: {
      food: 0,
      hammer: 0,
      gold: 2,
    },
    allowedTerrains: ['hill', 'mountain'] as TileType[],
  },
} satisfies Record<string, Resource>;

export type ResourceType = keyof typeof resources;

export const canPlaceResourceOnTerrain = (resourceType: ResourceType, terrain: TileType): boolean =>
  resources[resourceType].allowedTerrains.includes(terrain);
