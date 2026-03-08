import type { ProductionType } from '~/base/productions';

export type TileMetadata = {
  isLand: boolean;
  isWater: boolean;
  moveCost: number;
  defenseBonus: number;
  navalPassable: boolean;
};

export type Tile = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  metadata: TileMetadata;
  resourceProduction?: { [key in ProductionType]?: number };
};
