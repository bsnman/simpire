import type { Production } from '~/types/production';

export const productionTypes = {
  hammer: {
    type: 'hammer',
    name: 'Hammer',
    description: 'Used for production.',
    display: {
      image: null,
      svg: null,
    },
    color: '#FF0000',
  },
  food: {
    type: 'food',
    name: 'Food',
    description: 'Used for population growth.',
    display: {
      image: null,
      svg: null,
    },
    color: '#00FF00',
  },
  gold: {
    type: 'gold',
    name: 'Gold',
    description: 'Used for trade and wealth.',
    display: {
      image: null,
      svg: null,
    },
    color: '#FFD700',
  },
} satisfies Record<string, Production>;

export type ProductionType = keyof typeof productionTypes;
