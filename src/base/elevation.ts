import type { ProductionType } from '~/base/productions';

export type ElevationMetadata = {
  isLand: boolean;
  isWater: boolean;
  moveCostModifier: number;
  defenseBonus: number;
};

export type Elevation = {
  type: string;
  name: string;
  description: string;
  metadata: ElevationMetadata;
  bonusProduction?: { [key in ProductionType]?: number };
};

export const elevations = {
  underwater: {
    type: 'underwater',
    name: 'Underwater',
    description: 'Submerged depth profile used by sea tiles.',
    metadata: {
      isLand: false,
      isWater: true,
      moveCostModifier: 0,
      defenseBonus: 0,
    },
    bonusProduction: {
      food: 0,
      hammer: 0,
      gold: 0,
    },
  },
  flat: {
    type: 'flat',
    name: 'Flatland',
    description: 'Baseline elevation for open land terrain.',
    metadata: {
      isLand: true,
      isWater: false,
      moveCostModifier: 0,
      defenseBonus: 0,
    },
    bonusProduction: {
      food: 0,
      hammer: 0,
      gold: 0,
    },
  },
  hill: {
    type: 'hill',
    name: 'Hills',
    description: 'Elevated rolling terrain that slows movement and improves defense.',
    metadata: {
      isLand: true,
      isWater: false,
      moveCostModifier: 1,
      defenseBonus: 1,
    },
    bonusProduction: {
      food: -1,
      hammer: 1,
      gold: 0,
    },
  },
  mountain: {
    type: 'mountain',
    name: 'Mountain',
    description: 'High elevation terrain that is hard to traverse.',
    metadata: {
      isLand: true,
      isWater: false,
      moveCostModifier: 2,
      defenseBonus: 2,
    },
    bonusProduction: {
      food: -1,
      hammer: 2,
      gold: 0,
    },
  },
} satisfies Record<string, Elevation>;

export type ElevationType = keyof typeof elevations;

export const isWaterElevation = (elevation: ElevationType): boolean =>
  elevations[elevation].metadata.isWater;
