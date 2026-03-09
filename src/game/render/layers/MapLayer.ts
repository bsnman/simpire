import { Container, Graphics } from 'pixi.js';

import { tiles } from '~/base/tiles';
import { fromHexKey, toHexKey, type HexKey } from '~/types/hex';
import type { GameMap, MapTile } from '~/types/map';
import { axialToPixel, hexCornerPoints, pixelToAxial, roundAxial } from '~/game/render/hexMath';

const BORDER_COLOR = '#1D1D1D';
const FALLBACK_TILE_COLOR = '#6B7280';

export type HoveredTile = {
  key: HexKey;
  tile: MapTile;
};

export class MapLayer {
  public readonly container = new Container({ label: 'map-layer' });
  private currentMap: GameMap | null = null;
  private hoveredTileKey: HexKey | null = null;
  private hoveredTileChangeHandler: ((hoveredTile: HoveredTile | null) => void) | null = null;

  render(map: GameMap) {
    this.currentMap = map;
    this.container.removeChildren().forEach((child) => child.destroy());

    for (const key of map.tileKeys) {
      const tile = map.tilesByKey[key];
      const { q, r } = tile ?? fromHexKey(key);
      const center = axialToPixel({ q, r }, map.tileSize, map.layout);
      const points = hexCornerPoints(
        center.x + map.origin.x,
        center.y + map.origin.y,
        map.tileSize,
        map.layout,
      );

      const graphic = new Graphics();
      const tileColor = tile ? tiles[tile.terrain].color : FALLBACK_TILE_COLOR;

      graphic.poly(points, true);
      graphic.fill(tileColor);
      graphic.stroke({ color: BORDER_COLOR, width: 1.5 });

      this.container.addChild(graphic);
    }

    if (this.hoveredTileKey) {
      const hoveredTile = map.tilesByKey[this.hoveredTileKey];

      if (!hoveredTile) {
        this.updateHoveredTileKey(null);
        return;
      }

      this.notifyHoveredTileChange(this.hoveredTileKey, hoveredTile);
    }
  }

  setHoveredTileChangeHandler(handler: ((hoveredTile: HoveredTile | null) => void) | null) {
    this.hoveredTileChangeHandler = handler;

    if (!handler) {
      return;
    }

    if (!this.hoveredTileKey || !this.currentMap) {
      handler(null);
      return;
    }

    const hoveredTile = this.currentMap.tilesByKey[this.hoveredTileKey];
    handler(hoveredTile ? { key: this.hoveredTileKey, tile: hoveredTile } : null);
  }

  updateHoveredTileAtWorldPoint(worldX: number, worldY: number) {
    if (!this.currentMap) {
      this.updateHoveredTileKey(null);
      return;
    }

    const localPoint = {
      x: worldX - this.currentMap.origin.x,
      y: worldY - this.currentMap.origin.y,
    };
    const roundedCoord = roundAxial(
      pixelToAxial(localPoint, this.currentMap.tileSize, this.currentMap.layout),
    );
    const key = toHexKey(roundedCoord.q, roundedCoord.r);
    const tile = this.currentMap.tilesByKey[key];

    this.updateHoveredTileKey(tile ? key : null);
  }

  clearHoveredTile() {
    this.updateHoveredTileKey(null);
  }

  destroy() {
    this.container.destroy({ children: true });
    this.currentMap = null;
    this.hoveredTileKey = null;
    this.hoveredTileChangeHandler = null;
  }

  private updateHoveredTileKey(nextHoveredTileKey: HexKey | null) {
    if (this.hoveredTileKey === nextHoveredTileKey) {
      return;
    }

    this.hoveredTileKey = nextHoveredTileKey;

    if (!nextHoveredTileKey || !this.currentMap) {
      this.notifyHoveredTileChange(null);
      return;
    }

    const hoveredTile = this.currentMap.tilesByKey[nextHoveredTileKey];
    this.notifyHoveredTileChange(nextHoveredTileKey, hoveredTile);
  }

  private notifyHoveredTileChange(hoveredTileKey: null): void;
  private notifyHoveredTileChange(hoveredTileKey: HexKey, tile: MapTile | undefined): void;
  private notifyHoveredTileChange(hoveredTileKey: HexKey | null, tile?: MapTile) {
    if (!this.hoveredTileChangeHandler) {
      return;
    }

    if (!hoveredTileKey || !tile) {
      this.hoveredTileChangeHandler(null);
      return;
    }

    this.hoveredTileChangeHandler({
      key: hoveredTileKey,
      tile,
    });
  }
}
