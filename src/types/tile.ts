import type { ProductionType } from '/base/productions';

export type Tile = {
  type: string;
  name: string;
  description: string;
  image: string | null;
  color: string;
  resourceProduction?: { [key in ProductionType]?: number };
};
