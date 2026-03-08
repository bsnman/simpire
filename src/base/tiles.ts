import type { Tile } from '~/types/tile';

export const tiles = {
  grassland: {
    type: 'grassland',
    name: 'Grassland',
    description: 'Open fertile terrain suited for settlements and farming.',
    image: null,
    color: '#6EA84B',
    metadata: {
      isLand: true,
      isWater: false,
      moveCost: 1,
      defenseBonus: 0,
      navalPassable: false,
    },
    resourceProduction: {
      food: 2,
      hammer: 1,
      gold: 0,
    },
  },
  coastal_sea: {
    type: 'coastal_sea',
    name: 'Coastal Sea',
    description: 'Shallow water near land and coastlines.',
    image: null,
    color: '#4D9FD8',
    metadata: {
      isLand: false,
      isWater: true,
      moveCost: 1,
      defenseBonus: 0,
      navalPassable: true,
    },
    resourceProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
  },
  deep_sea: {
    type: 'deep_sea',
    name: 'Deep Sea',
    description: 'Open waters beyond the coast but not the furthest ocean.',
    image: null,
    color: '#2C6FAF',
    metadata: {
      isLand: false,
      isWater: true,
      moveCost: 2,
      defenseBonus: 0,
      navalPassable: true,
    },
    resourceProduction: {
      food: 1,
      hammer: 0,
      gold: 2,
    },
  },
  ocean: {
    type: 'ocean',
    name: 'Ocean',
    description: 'The deepest and widest water far from coastlines.',
    image: null,
    color: '#16477F',
    metadata: {
      isLand: false,
      isWater: true,
      moveCost: 3,
      defenseBonus: 0,
      navalPassable: true,
    },
    resourceProduction: {
      food: 0,
      hammer: 0,
      gold: 2,
    },
  },
  hill: {
    type: 'hill',
    name: 'Hills',
    description: 'Rolling elevations that slow movement and aid defense.',
    image: null,
    color: '#9A724C',
    metadata: {
      isLand: true,
      isWater: false,
      moveCost: 2,
      defenseBonus: 1,
      navalPassable: false,
    },
    resourceProduction: {
      food: 0,
      hammer: 1,
      gold: 0,
    },
  },
  mountain: {
    type: 'mountain',
    name: 'Mountain',
    description: 'High elevation terrain that is difficult to cross.',
    image: null,
    color: '#7A7F88',
    metadata: {
      isLand: true,
      isWater: false,
      moveCost: 3,
      defenseBonus: 2,
      navalPassable: false,
    },
    resourceProduction: {
      food: 0,
      hammer: 2,
      gold: 0,
    },
  },
  plains: {
    type: 'plains',
    name: 'Plains',
    description: 'Dry open lowlands with balanced yields.',
    image: null,
    color: '#CDBA67',
    metadata: {
      isLand: true,
      isWater: false,
      moveCost: 1,
      defenseBonus: 0,
      navalPassable: false,
    },
    resourceProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
  },
} satisfies Record<string, Tile>;

export type TileType = keyof typeof tiles;
