import type { TileType } from '~/base/tiles';
import type { HexKey, HexLayout } from '~/types/hex';

export type MapTile = {
  q: number;
  r: number;
  terrain: TileType;
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
