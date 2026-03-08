import { Container, Graphics } from 'pixi.js';

import { tiles } from '../../../base/tiles';
import { fromHexKey } from '../../../types/hex';
import type { GameMap } from '../../../types/map';
import { axialToPixel, hexCornerPoints } from '../hexMath';

const BORDER_COLOR = '#1D1D1D';
const FALLBACK_TILE_COLOR = '#6B7280';

export class MapLayer {
  public readonly container = new Container({ label: 'map-layer' });

  render(map: GameMap) {
    this.container.removeChildren().forEach((child) => child.destroy());

    for (const key of map.tileKeys) {
      const tile = map.tilesByKey[key];
      const { q, r } = tile ?? fromHexKey(key);
      const center = axialToPixel({ q, r }, map.tileSize, map.layout);
      const points = hexCornerPoints(center.x + map.origin.x, center.y + map.origin.y, map.tileSize, map.layout);

      const graphic = new Graphics();
      const tileColor = tile ? tiles[tile.terrain].color : FALLBACK_TILE_COLOR;

      graphic.poly(points, true);
      graphic.fill(tileColor);
      graphic.stroke({ color: BORDER_COLOR, width: 1.5 });

      this.container.addChild(graphic);
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
