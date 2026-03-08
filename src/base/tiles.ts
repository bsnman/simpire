import type { Tile } from '/types/tile';

export const tiles = {
  grass: {
    type: 'grass',
    name: 'Grass',
    description: 'A patch of grass.',
    image: null,
    color: '#00FF00',
    resourceProduction: {
      food: 2,
      hammer: 1,
      gold: 0,
    },
  },
  water: {
    type: 'water',
    name: 'Water',
    description: 'A body of water.',
    image: null,
    color: '#0000FF',
    resourceProduction: {
      food: 1,
      hammer: 0,
      gold: 1,
    },
  },
  hill: {
    type: 'hill',
    name: 'Hill',
    description: 'A small hill.',
    image: null,
    color: '#A0522D',
    resourceProduction: {
      food: 0,
      hammer: 1,
      gold: 0,
    },
  },
  plains: {
    type: 'plains',
    name: 'Plains',
    description: 'A vast plain.',
    image: null,
    color: '#FFFF00',
    resourceProduction: {
      food: 1,
      hammer: 0,
      gold: 0,
    },
  },
} satisfies Record<string, Tile>;

export type TileType = keyof typeof tiles;
