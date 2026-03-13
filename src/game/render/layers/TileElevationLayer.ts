import { Group } from 'three';

import type { GameMap } from '~/types/map';
import type { ElevationLayerConfig } from '~/game/render/mapRenderConfig';
import { MAP_ELEVATION_LAYER_GROUP_NAME } from '~/game/render/layers/mapLayerObjectNames';
import { TerrainDecorationFactory } from '~/game/render/three/TerrainDecorationFactory';

export type TerrainDecorationFactoryLike = Pick<
  TerrainDecorationFactory,
  'populateTerrainDecorations' | 'destroy'
>;

export class TileElevationLayer {
  public readonly group = new Group();

  private readonly terrainDecorationFactory: TerrainDecorationFactoryLike;
  private decorationRenderToken = 0;

  constructor(
    terrainDecorationFactory: TerrainDecorationFactoryLike = new TerrainDecorationFactory(),
  ) {
    this.terrainDecorationFactory = terrainDecorationFactory;
    this.group.name = MAP_ELEVATION_LAYER_GROUP_NAME;
  }

  render(map: GameMap, config: ElevationLayerConfig) {
    const renderToken = ++this.decorationRenderToken;

    this.group.clear();

    if (!config.enabled) {
      return;
    }

    void this.terrainDecorationFactory.populateTerrainDecorations({
      map,
      targetGroup: this.group,
      zOffset: config.zOffset,
      scaleMultiplier: config.scaleMultiplier,
      isStale: () => renderToken !== this.decorationRenderToken,
    });
  }

  destroy() {
    this.decorationRenderToken += 1;
    this.group.clear();
    this.terrainDecorationFactory.destroy();
  }
}
