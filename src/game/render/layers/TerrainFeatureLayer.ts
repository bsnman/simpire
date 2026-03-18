import { Group } from 'three';

import type { GameMap } from '~/types/map';
import type { MapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import { MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME } from '~/game/render/layers/mapLayerObjectNames';
import type {
  ElevationLayerConfig,
  TerrainFeatureLayerConfig,
} from '~/game/render/mapRenderConfig';
import { TerrainFeatureDecorationFactory } from '~/game/render/three/TerrainFeatureDecorationFactory';

export type TerrainFeatureDecorationFactoryLike = Pick<
  TerrainFeatureDecorationFactory,
  'populateTerrainFeatureDecorations' | 'destroy'
>;

export class TerrainFeatureLayer {
  public readonly group = new Group();

  private readonly terrainFeatureDecorationFactory: TerrainFeatureDecorationFactoryLike;
  private decorationRenderToken = 0;

  constructor(
    terrainFeatureDecorationFactory: TerrainFeatureDecorationFactoryLike = new TerrainFeatureDecorationFactory(),
  ) {
    this.terrainFeatureDecorationFactory = terrainFeatureDecorationFactory;
    this.group.name = MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME;
  }

  render(
    map: GameMap,
    tileRenderData: ReadonlyArray<MapTileRenderData>,
    terrainFeatureConfig: TerrainFeatureLayerConfig,
    elevationConfig: ElevationLayerConfig,
  ) {
    const renderToken = ++this.decorationRenderToken;

    this.group.clear();

    if (!terrainFeatureConfig.enabled) {
      return;
    }

    void this.terrainFeatureDecorationFactory.populateTerrainFeatureDecorations({
      map,
      tileRenderData,
      targetGroup: this.group,
      terrainFeatureConfig,
      elevationConfig,
      isStale: () => renderToken !== this.decorationRenderToken,
    });
  }

  destroy() {
    this.decorationRenderToken += 1;
    this.group.clear();
    this.terrainFeatureDecorationFactory.destroy();
  }
}
