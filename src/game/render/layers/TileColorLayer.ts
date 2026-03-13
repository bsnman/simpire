import { Group } from 'three';

import { tiles } from '~/base/tiles';
import type { GameMap } from '~/types/map';
import type { TileColorLayerConfig } from '~/game/render/mapRenderConfig';
import type { MapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import { HexTileMeshFactory } from '~/game/render/three/HexTileMeshFactory';

export class TileColorLayer {
  public readonly group = new Group();

  private readonly tileMeshFactory: HexTileMeshFactory;

  constructor(tileMeshFactory: HexTileMeshFactory = new HexTileMeshFactory()) {
    this.tileMeshFactory = tileMeshFactory;
    this.group.name = 'map-tile-color-layer';
  }

  render(
    map: GameMap,
    tileRenderData: ReadonlyArray<MapTileRenderData>,
    config: TileColorLayerConfig,
  ) {
    this.group.clear();

    if (!config.enabled) {
      return;
    }

    for (const tileData of tileRenderData) {
      const tileColor = tileData.tile
        ? tiles[tileData.tile.terrain].color
        : config.fallbackTileColor;
      const mesh = this.tileMeshFactory.createTileFillMesh(
        map.tileSize,
        map.layout,
        tileColor,
        tileData.key,
      );

      mesh.position.set(tileData.worldX, tileData.worldY, 0);
      this.group.add(mesh);
    }
  }

  destroy() {
    this.group.clear();
    this.tileMeshFactory.destroy();
  }
}
