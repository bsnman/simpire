import { Group } from 'three';

import type { GameMap } from '~/types/map';
import type { HexOutlineLayerConfig } from '~/game/render/mapRenderConfig';
import type { MapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import { HexOutlineMeshFactory } from '~/game/render/three/HexOutlineMeshFactory';

export class HexOutlineLayer {
  public readonly group = new Group();

  private readonly outlineMeshFactory: HexOutlineMeshFactory;

  constructor(outlineMeshFactory: HexOutlineMeshFactory = new HexOutlineMeshFactory()) {
    this.outlineMeshFactory = outlineMeshFactory;
    this.group.name = 'map-hex-outline-layer';
  }

  render(
    map: GameMap,
    tileRenderData: ReadonlyArray<MapTileRenderData>,
    config: HexOutlineLayerConfig,
  ) {
    this.group.clear();

    if (!config.enabled) {
      return;
    }

    for (const tileData of tileRenderData) {
      const line = this.outlineMeshFactory.createHexOutline(
        map.tileSize,
        map.layout,
        config.color,
        tileData.key,
      );

      line.position.set(tileData.worldX, tileData.worldY, config.zOffset);
      this.group.add(line);
    }
  }

  destroy() {
    this.group.clear();
    this.outlineMeshFactory.destroy();
  }
}
