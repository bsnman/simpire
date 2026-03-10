import type { ProductionType } from '~/base/productions';
import type { ElevationType } from '~/base/elevation';
import type { TileType } from '~/base/tiles';

export type ResourceRarity = 'common' | 'uncommon' | 'rare';

export type Resource = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  rarity: ResourceRarity;
  spawnWeight: number;
  bonusProduction?: { [key in ProductionType]?: number };
  allowedTerrains: TileType[];
  allowedElevations: ElevationType[];
};

export const resources = {
  stone: {
    type: 'stone',
    name: 'Stone',
    description: 'Reliable masonry source for early construction projects.',
    image: null,
    color: '#8D9199',
    rarity: 'common',
    spawnWeight: 1.2,
    bonusProduction: {
      food: 0,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: [] as TileType[],
    allowedElevations: ['hill', 'mountain'] as ElevationType[],
  },
  clay: {
    type: 'clay',
    name: 'Clay',
    description: 'Workable earth used for bricks, pottery, and basic infrastructure.',
    image: null,
    color: '#B47A56',
    rarity: 'common',
    spawnWeight: 1.1,
    bonusProduction: {
      food: 0,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['grassland', 'plains', 'coastal_sea'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  fish: {
    type: 'fish',
    name: 'Fish',
    description: 'Abundant marine food source in near and mid-depth waters.',
    image: null,
    color: '#5DADE2',
    rarity: 'common',
    spawnWeight: 1.35,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['coastal_sea', 'deep_sea'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  wheat: {
    type: 'wheat',
    name: 'Wheat',
    description: 'Staple cereal crop that boosts food output on fertile land.',
    image: null,
    color: '#EAC117',
    rarity: 'common',
    spawnWeight: 1.3,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['grassland', 'plains'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  rice: {
    type: 'rice',
    name: 'Rice',
    description: 'Water-intensive grain suited to fertile lowland fields.',
    image: null,
    color: '#C9DA2A',
    rarity: 'common',
    spawnWeight: 1.15,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['grassland'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  iron_ore: {
    type: 'iron_ore',
    name: 'Iron Ore',
    description: 'Strategic metal deposit used for advanced military and industrial production.',
    image: null,
    color: '#6B7280',
    rarity: 'uncommon',
    spawnWeight: 0.75,
    bonusProduction: {
      food: 0,
      hammer: 2,
      gold: 0,
    },
    allowedTerrains: [] as TileType[],
    allowedElevations: ['hill', 'mountain'] as ElevationType[],
  },
  bronze_ore: {
    type: 'bronze_ore',
    name: 'Bronze Ore',
    description: 'Early strategic metal source with mixed production and trade value.',
    image: null,
    color: '#B87333',
    rarity: 'uncommon',
    spawnWeight: 0.92,
    bonusProduction: {
      food: 0,
      hammer: 1,
      gold: 1,
    },
    allowedTerrains: ['plains'] as TileType[],
    allowedElevations: ['hill'] as ElevationType[],
  },
  coal: {
    type: 'coal',
    name: 'Coal',
    description: 'Dense fuel source that accelerates heavy production.',
    image: null,
    color: '#363B44',
    rarity: 'uncommon',
    spawnWeight: 0.7,
    bonusProduction: {
      food: 0,
      hammer: 2,
      gold: 0,
    },
    allowedTerrains: [] as TileType[],
    allowedElevations: ['hill', 'mountain'] as ElevationType[],
  },
  crab: {
    type: 'crab',
    name: 'Crab',
    description: 'Valuable coastal shellfish that improves food and trade value.',
    image: null,
    color: '#D98880',
    rarity: 'uncommon',
    spawnWeight: 0.85,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
    allowedTerrains: ['coastal_sea'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  tuna: {
    type: 'tuna',
    name: 'Tuna',
    description: 'Open-water fishery supporting strong food supply.',
    image: null,
    color: '#2E86C1',
    rarity: 'uncommon',
    spawnWeight: 0.72,
    bonusProduction: {
      food: 2,
      hammer: 0,
      gold: 0,
    },
    allowedTerrains: ['deep_sea', 'ocean'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  cattle: {
    type: 'cattle',
    name: 'Cattle',
    description: 'Livestock resource providing both food and labor output.',
    image: null,
    color: '#8C5A3C',
    rarity: 'uncommon',
    spawnWeight: 0.9,
    bonusProduction: {
      food: 1,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['grassland', 'plains'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  sheep: {
    type: 'sheep',
    name: 'Sheep',
    description: 'Pastoral herd resource that supports food and textile economy.',
    image: null,
    color: '#D7D3C8',
    rarity: 'uncommon',
    spawnWeight: 0.86,
    bonusProduction: {
      food: 1,
      hammer: 1,
      gold: 0,
    },
    allowedTerrains: ['plains'] as TileType[],
    allowedElevations: ['hill'] as ElevationType[],
  },
  salt: {
    type: 'salt',
    name: 'Salt',
    description: 'Preservation mineral that boosts both food utility and trade.',
    image: null,
    color: '#F4F7F9',
    rarity: 'uncommon',
    spawnWeight: 0.8,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
    allowedTerrains: ['plains', 'coastal_sea'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  spices: {
    type: 'spices',
    name: 'Spices',
    description: 'High-value crop commodity for food flavor and trade routes.',
    image: null,
    color: '#E67E22',
    rarity: 'uncommon',
    spawnWeight: 0.68,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
    allowedTerrains: ['grassland', 'plains'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  gold_ore: {
    type: 'gold_ore',
    name: 'Gold Ore',
    description: 'Precious mineral vein with very high wealth output.',
    image: null,
    color: '#D4AF37',
    rarity: 'rare',
    spawnWeight: 0.42,
    bonusProduction: {
      food: 0,
      hammer: 0,
      gold: 3,
    },
    allowedTerrains: [] as TileType[],
    allowedElevations: ['hill', 'mountain'] as ElevationType[],
  },
  gems: {
    type: 'gems',
    name: 'Gems',
    description: 'Luxury mineral deposit with exceptional trade value.',
    image: null,
    color: '#7D3C98',
    rarity: 'rare',
    spawnWeight: 0.36,
    bonusProduction: {
      food: 0,
      hammer: 1,
      gold: 2,
    },
    allowedTerrains: [] as TileType[],
    allowedElevations: ['hill', 'mountain'] as ElevationType[],
  },
  pearls: {
    type: 'pearls',
    name: 'Pearls',
    description: 'Rare marine luxury resource harvested in coastal shallows.',
    image: null,
    color: '#EAEFF5',
    rarity: 'rare',
    spawnWeight: 0.34,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 2,
    },
    allowedTerrains: ['coastal_sea'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
  whales: {
    type: 'whales',
    name: 'Whales',
    description: 'Rare deep-water resource with high economic return.',
    image: null,
    color: '#4F6D8A',
    rarity: 'rare',
    spawnWeight: 0.28,
    bonusProduction: {
      food: 1,
      hammer: 0,
      gold: 2,
    },
    allowedTerrains: ['deep_sea', 'ocean'] as TileType[],
    allowedElevations: [] as ElevationType[],
  },
} satisfies Record<string, Resource>;

export type ResourceType = keyof typeof resources;

export const canPlaceResourceOnTerrain = (
  resourceType: ResourceType,
  terrain: TileType,
  elevation: ElevationType = 'flat',
): boolean => {
  const resource = resources[resourceType];
  const hasTerrainRules = resource.allowedTerrains.length > 0;
  const hasElevationRules = resource.allowedElevations.length > 0;
  const terrainAllowed = resource.allowedTerrains.includes(terrain);
  const elevationAllowed = resource.allowedElevations.includes(elevation);

  if (!hasTerrainRules && !hasElevationRules) {
    return false;
  }

  return (hasTerrainRules && terrainAllowed) || (hasElevationRules && elevationAllowed);
};

export const getResourcesForTerrain = (
  terrain: TileType,
  elevation: ElevationType = 'flat',
): ResourceType[] =>
  (Object.keys(resources) as ResourceType[]).filter((resourceType) =>
    canPlaceResourceOnTerrain(resourceType, terrain, elevation),
  );
