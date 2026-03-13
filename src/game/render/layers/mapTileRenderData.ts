import { fromHexKey, type HexKey } from '~/types/hex';
import type { GameMap, MapTile } from '~/types/map';
import { axialToPixel } from '~/game/render/hexMath';

export type MapTileRenderData = {
  key: HexKey;
  tile: MapTile | null;
  q: number;
  r: number;
  worldX: number;
  worldY: number;
};

export const buildMapTileRenderData = (map: GameMap): MapTileRenderData[] =>
  map.tileKeys.map((key) => {
    const tile = map.tilesByKey[key] ?? null;
    const coord = tile ?? fromHexKey(key);
    const center = axialToPixel({ q: coord.q, r: coord.r }, map.tileSize, map.layout);

    return {
      key,
      tile,
      q: coord.q,
      r: coord.r,
      worldX: center.x + map.origin.x,
      worldY: center.y + map.origin.y,
    };
  });
