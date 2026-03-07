import type { Tile } from './tile';

export type Map = {
  width: number;
  height: number;
  tiles: Tile[][];
};
