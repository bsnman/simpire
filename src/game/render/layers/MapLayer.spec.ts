import { Group, OrthographicCamera, Raycaster } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { MapLayer } from '~/game/render/layers/MapLayer';
import {
  TerrainFeatureLayer,
  type TerrainFeatureDecorationFactoryLike,
} from '~/game/render/layers/TerrainFeatureLayer';
import {
  TileElevationLayer,
  type TerrainDecorationFactoryLike,
} from '~/game/render/layers/TileElevationLayer';
import {
  MAP_ELEVATION_LAYER_GROUP_NAME,
  MAP_HEX_OUTLINE_LAYER_GROUP_NAME,
  MAP_INTERACTION_LAYER_GROUP_NAME,
  MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME,
  MAP_TILE_COLOR_LAYER_GROUP_NAME,
} from '~/game/render/layers/mapLayerObjectNames';
import {
  DEFAULT_MAP_RENDER_CONFIG,
  normalizeMapRenderConfig,
  type MapRenderConfig,
} from '~/game/render/mapRenderConfig';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

class FakeTerrainDecorationFactory implements TerrainDecorationFactoryLike {
  public readonly populateTerrainDecorations = vi.fn(
    async ({
      map,
      targetGroup,
      isStale,
    }: Parameters<TerrainDecorationFactoryLike['populateTerrainDecorations']>[0]) => {
      if (isStale()) {
        return;
      }

      const hasElevationDecoration = map.tileKeys.some((key) => {
        const tile = map.tilesByKey[key];
        return (
          tile?.elevation === 'flat' || tile?.elevation === 'hill' || tile?.elevation === 'mountain'
        );
      });

      if (!hasElevationDecoration) {
        return;
      }

      const decoration = new Group();
      decoration.name = 'fake-terrain-decoration';
      targetGroup.add(decoration);
    },
  );

  public readonly destroy = vi.fn();
}

class FakeTerrainFeatureDecorationFactory implements TerrainFeatureDecorationFactoryLike {
  public readonly populateTerrainFeatureDecorations = vi.fn(
    async ({
      targetGroup,
      tileRenderData,
      isStale,
    }: Parameters<TerrainFeatureDecorationFactoryLike['populateTerrainFeatureDecorations']>[0]) => {
      if (isStale()) {
        return;
      }

      const hasTerrainFeatures = tileRenderData.some((tileData) => tileData.tile?.terrainFeatureId);

      if (!hasTerrainFeatures) {
        return;
      }

      const decoration = new Group();
      decoration.name = 'fake-terrain-feature-decoration';
      targetGroup.add(decoration);
    },
  );

  public readonly destroy = vi.fn();
}

const TEST_MAP: GameMap = {
  id: 'test-map',
  layout: 'pointy',
  tileSize: 50,
  origin: { x: 0, y: 0 },
  tileKeys: [toHexKey(0, 0)],
  tilesByKey: {
    [toHexKey(0, 0)]: {
      q: 0,
      r: 0,
      terrain: 'grassland',
      elevation: 'hill',
      terrainFeatureId: 'forest',
    },
  },
};

const FLAT_TEST_MAP: GameMap = {
  ...TEST_MAP,
  id: 'flat-test-map',
  tilesByKey: {
    [toHexKey(0, 0)]: {
      q: 0,
      r: 0,
      terrain: 'grassland',
      elevation: 'flat',
      terrainFeatureId: 'forest',
    },
  },
};

const getLayerGroup = (mapLayer: MapLayer, groupName: string): Group => {
  const group = mapLayer.group.children.find((child) => child.name === groupName);

  if (!(group instanceof Group)) {
    throw new Error(`Expected layer group "${groupName}" to exist.`);
  }

  return group;
};

const expectLayerCounts = (
  mapLayer: MapLayer,
  counts: {
    tileColor: number;
    hexOutline: number;
    elevation: number;
    terrainFeature: number;
    interaction: number;
  },
) => {
  expect(getLayerGroup(mapLayer, MAP_TILE_COLOR_LAYER_GROUP_NAME).children).toHaveLength(
    counts.tileColor,
  );
  expect(getLayerGroup(mapLayer, MAP_HEX_OUTLINE_LAYER_GROUP_NAME).children).toHaveLength(
    counts.hexOutline,
  );
  expect(getLayerGroup(mapLayer, MAP_ELEVATION_LAYER_GROUP_NAME).children).toHaveLength(
    counts.elevation,
  );
  expect(getLayerGroup(mapLayer, MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME).children).toHaveLength(
    counts.terrainFeature,
  );
  expect(getLayerGroup(mapLayer, MAP_INTERACTION_LAYER_GROUP_NAME).children).toHaveLength(
    counts.interaction,
  );
};

const createTestCamera = (): OrthographicCamera => {
  const camera = new OrthographicCamera(-100, 100, 100, -100, 0.1, 500);

  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const createMapLayer = () => {
  const terrainDecorationFactory = new FakeTerrainDecorationFactory();
  const terrainFeatureDecorationFactory = new FakeTerrainFeatureDecorationFactory();
  const mapLayer = new MapLayer({
    tileElevationLayer: new TileElevationLayer(terrainDecorationFactory),
    terrainFeatureLayer: new TerrainFeatureLayer(terrainFeatureDecorationFactory),
  });

  return {
    mapLayer,
    terrainDecorationFactory,
    terrainFeatureDecorationFactory,
  };
};

describe('MapLayer', () => {
  it('renders elevation decorations for flat tiles when a flat decoration model is registered', () => {
    const { mapLayer } = createMapLayer();

    mapLayer.render(FLAT_TEST_MAP, DEFAULT_MAP_RENDER_CONFIG);

    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 1,
      elevation: 1,
      terrainFeature: 1,
      interaction: 1,
    });
  });

  it('disables each visual layer independently without removing other layers', () => {
    const { mapLayer, terrainDecorationFactory, terrainFeatureDecorationFactory } =
      createMapLayer();

    mapLayer.render(TEST_MAP, DEFAULT_MAP_RENDER_CONFIG);
    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 1,
      elevation: 1,
      terrainFeature: 1,
      interaction: 1,
    });

    mapLayer.render(
      TEST_MAP,
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
      }),
    );
    expectLayerCounts(mapLayer, {
      tileColor: 0,
      hexOutline: 1,
      elevation: 1,
      terrainFeature: 1,
      interaction: 1,
    });

    mapLayer.render(
      TEST_MAP,
      normalizeMapRenderConfig({
        hexOutline: {
          enabled: false,
        },
      }),
    );
    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 0,
      elevation: 1,
      terrainFeature: 1,
      interaction: 1,
    });

    mapLayer.render(
      TEST_MAP,
      normalizeMapRenderConfig({
        elevation: {
          enabled: false,
        },
      }),
    );
    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 1,
      elevation: 0,
      terrainFeature: 1,
      interaction: 1,
    });

    mapLayer.render(
      TEST_MAP,
      normalizeMapRenderConfig({
        terrainFeature: {
          enabled: false,
        },
      }),
    );
    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 1,
      elevation: 1,
      terrainFeature: 0,
      interaction: 1,
    });

    expect(terrainDecorationFactory.populateTerrainDecorations).toHaveBeenCalledTimes(4);
    expect(terrainFeatureDecorationFactory.populateTerrainFeatureDecorations).toHaveBeenCalledTimes(
      4,
    );
  });

  it('keeps hover picking working when tile color is disabled', () => {
    const { mapLayer } = createMapLayer();
    const camera = createTestCamera();
    const raycaster = new Raycaster();
    let hoveredTileKey: string | null = null;

    mapLayer.setHoveredTileChangeHandler((hoveredTile) => {
      hoveredTileKey = hoveredTile?.key ?? null;
    });
    mapLayer.render(
      TEST_MAP,
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
      }),
    );

    mapLayer.group.updateMatrixWorld(true);
    mapLayer.updateHoveredTileAtScreenPoint({
      screenX: 100,
      screenY: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera,
      raycaster,
    });

    expect(getLayerGroup(mapLayer, MAP_TILE_COLOR_LAYER_GROUP_NAME).children).toHaveLength(0);
    expect(getLayerGroup(mapLayer, MAP_HEX_OUTLINE_LAYER_GROUP_NAME).children).toHaveLength(1);
    expect(getLayerGroup(mapLayer, MAP_ELEVATION_LAYER_GROUP_NAME).children).toHaveLength(1);
    expect(getLayerGroup(mapLayer, MAP_TERRAIN_FEATURE_LAYER_GROUP_NAME).children).toHaveLength(1);
    expect(getLayerGroup(mapLayer, MAP_INTERACTION_LAYER_GROUP_NAME).children).toHaveLength(1);
    expect(hoveredTileKey).toBe('0,0');
  });

  it('keeps hover picking working with elevation and terrain feature decorations enabled', () => {
    const { mapLayer } = createMapLayer();
    const camera = createTestCamera();
    const raycaster = new Raycaster();
    let hoveredTileKey: string | null = null;

    mapLayer.setHoveredTileChangeHandler((hoveredTile) => {
      hoveredTileKey = hoveredTile?.key ?? null;
    });
    mapLayer.render(TEST_MAP, DEFAULT_MAP_RENDER_CONFIG);

    mapLayer.group.updateMatrixWorld(true);
    mapLayer.updateHoveredTileAtScreenPoint({
      screenX: 100,
      screenY: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera,
      raycaster,
    });

    expectLayerCounts(mapLayer, {
      tileColor: 1,
      hexOutline: 1,
      elevation: 1,
      terrainFeature: 1,
      interaction: 1,
    });
    expect(hoveredTileKey).toBe('0,0');
  });

  it('keeps hover picking working when all visual layers are disabled', () => {
    const { mapLayer } = createMapLayer();
    const camera = createTestCamera();
    const raycaster = new Raycaster();
    let hoveredTileKey: string | null = null;

    mapLayer.setHoveredTileChangeHandler((hoveredTile) => {
      hoveredTileKey = hoveredTile?.key ?? null;
    });

    const hiddenVisualConfig: MapRenderConfig = normalizeMapRenderConfig({
      tileColor: {
        enabled: false,
      },
      hexOutline: {
        enabled: false,
      },
      elevation: {
        enabled: false,
      },
      terrainFeature: {
        enabled: false,
      },
    });

    mapLayer.render(TEST_MAP, hiddenVisualConfig);
    mapLayer.group.updateMatrixWorld(true);
    mapLayer.updateHoveredTileAtScreenPoint({
      screenX: 100,
      screenY: 100,
      viewportWidth: 200,
      viewportHeight: 200,
      camera,
      raycaster,
    });

    expectLayerCounts(mapLayer, {
      tileColor: 0,
      hexOutline: 0,
      elevation: 0,
      terrainFeature: 0,
      interaction: 1,
    });
    expect(hoveredTileKey).toBe('0,0');

    mapLayer.clearHoveredTile();
    expect(hoveredTileKey).toBeNull();
  });
});
