import { Group, OrthographicCamera, Scene } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameRenderer } from '~/game/render/GameRenderer';
import { DEFAULT_MAP_RENDER_CONFIG, normalizeMapRenderConfig } from '~/game/render/mapRenderConfig';
import type { ThreeSceneSetup } from '~/game/render/three/sceneSetup';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

const TEST_MAP: GameMap = {
  id: 'renderer-test-map',
  layout: 'pointy',
  tileSize: 50,
  origin: { x: 0, y: 0 },
  tileKeys: [toHexKey(0, 0)],
  tilesByKey: {
    [toHexKey(0, 0)]: {
      q: 0,
      r: 0,
      terrain: 'grassland',
      elevation: 'flat',
    },
  },
};

describe('GameRenderer', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis.window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redraws the last rendered map when map render config changes at runtime', async () => {
    const mapLayer = {
      group: new Group(),
      clearHoveredTile: vi.fn(),
      destroy: vi.fn(),
      render: vi.fn(),
      setHoveredTileChangeHandler: vi.fn(),
      updateHoveredTileAtScreenPoint: vi.fn(),
    };
    const sceneSetup: ThreeSceneSetup = {
      scene: new Scene(),
      camera: new OrthographicCamera(-100, 100, 100, -100, 0.1, 2000),
      renderer: {
        render: vi.fn(),
      } as unknown as ThreeSceneSetup['renderer'],
      getViewportSize: () => ({ width: 200, height: 200 }),
      syncViewportSize: () => ({ width: 200, height: 200 }),
      destroy: vi.fn(),
    };
    const sceneSetupFactory = vi.fn(() => sceneSetup);
    const renderer = new GameRenderer({
      mapLayer,
      sceneSetupFactory,
    });
    const canvas = globalThis.document.createElement('canvas');

    await renderer.init(canvas);
    renderer.renderMap(TEST_MAP);

    expect(sceneSetupFactory).toHaveBeenCalledOnce();
    expect(mapLayer.render).toHaveBeenNthCalledWith(
      1,
      TEST_MAP,
      normalizeMapRenderConfig(DEFAULT_MAP_RENDER_CONFIG),
    );

    renderer.setMapRenderConfig({
      tileColor: {
        enabled: false,
      },
    });

    expect(mapLayer.render).toHaveBeenNthCalledWith(
      2,
      TEST_MAP,
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
      }),
    );
    expect(renderer.getMapRenderConfig()).toEqual(
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
      }),
    );

    renderer.setMapRenderConfig({
      elevation: {
        enabled: false,
      },
    });

    expect(mapLayer.render).toHaveBeenNthCalledWith(
      3,
      TEST_MAP,
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
        elevation: {
          enabled: false,
        },
      }),
    );
    expect(renderer.getMapRenderConfig()).toEqual(
      normalizeMapRenderConfig({
        tileColor: {
          enabled: false,
        },
        elevation: {
          enabled: false,
        },
      }),
    );

    renderer.destroy();

    expect(mapLayer.destroy).toHaveBeenCalledOnce();
    expect(sceneSetup.destroy).toHaveBeenCalledOnce();
  });

  it('keeps using the latest merged config across repeated toggles and renderMap calls', async () => {
    const mapLayer = {
      group: new Group(),
      clearHoveredTile: vi.fn(),
      destroy: vi.fn(),
      render: vi.fn(),
      setHoveredTileChangeHandler: vi.fn(),
      updateHoveredTileAtScreenPoint: vi.fn(),
    };
    const sceneSetup: ThreeSceneSetup = {
      scene: new Scene(),
      camera: new OrthographicCamera(-100, 100, 100, -100, 0.1, 2000),
      renderer: {
        render: vi.fn(),
      } as unknown as ThreeSceneSetup['renderer'],
      getViewportSize: () => ({ width: 200, height: 200 }),
      syncViewportSize: () => ({ width: 200, height: 200 }),
      destroy: vi.fn(),
    };
    const renderer = new GameRenderer({
      mapLayer,
      sceneSetupFactory: vi.fn(() => sceneSetup),
    });
    const canvas = globalThis.document.createElement('canvas');

    await renderer.init(canvas);
    renderer.renderMap(TEST_MAP);
    renderer.setMapRenderConfig({
      tileColor: {
        enabled: false,
      },
    });
    renderer.setMapRenderConfig({
      hexOutline: {
        enabled: false,
      },
    });
    renderer.renderMap(TEST_MAP);
    renderer.renderMap(TEST_MAP);

    const expectedConfig = normalizeMapRenderConfig({
      tileColor: {
        enabled: false,
      },
      hexOutline: {
        enabled: false,
      },
    });

    expect(mapLayer.render).toHaveBeenNthCalledWith(4, TEST_MAP, expectedConfig);
    expect(mapLayer.render).toHaveBeenNthCalledWith(5, TEST_MAP, expectedConfig);
    expect(renderer.getMapRenderConfig()).toEqual(expectedConfig);

    renderer.destroy();

    expect(mapLayer.destroy).toHaveBeenCalledOnce();
  });
});
