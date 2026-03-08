import type { TileType } from '~/base/tiles';
import type { ResourceType } from '~/base/resources';
import type { HexKey, HexLayout } from '~/types/hex';

export type MapTile = {
  q: number;
  r: number;
  terrain: TileType;
  resourceId?: ResourceType;
};

export type GameMap = {
  id: string;
  layout: HexLayout;
  tileSize: number;
  origin: {
    x: number;
    y: number;
  };
  tilesByKey: Record<HexKey, MapTile>;
  tileKeys: HexKey[];
};
