import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameRenderer } from '~/game/render/GameRenderer';
import { MapLayer } from '~/game/render/layers/MapLayer';
import { DEFAULT_MAP_RENDER_CONFIG, normalizeMapRenderConfig } from '~/game/render/mapRenderConfig';
import type { ThreeSceneSetup } from '~/game/render/three/sceneSetup';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

const VIEWPORT_SIZE = { width: 200, height: 200 };
const MAP_PLANE = new Plane(new Vector3(0, 0, 1), 0);

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

const HOVER_TEST_MAP: GameMap = {
  id: 'renderer-hover-map',
  layout: 'pointy',
  tileSize: 50,
  origin: { x: 100, y: 100 },
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

const createSceneSetupStub = (): ThreeSceneSetup => ({
  scene: new Scene(),
  camera: new OrthographicCamera(-100, 100, 100, -100, 0.1, 2000),
  renderer: {
    render: vi.fn(),
  } as unknown as ThreeSceneSetup['renderer'],
  getViewportSize: () => VIEWPORT_SIZE,
  syncViewportSize: () => VIEWPORT_SIZE,
  destroy: vi.fn(),
});

const createMapLayerStub = (group: Group = new Group()) => ({
  group,
  clearHoveredTile: vi.fn(),
  destroy: vi.fn(),
  render: vi.fn(),
  setHoveredTileChangeHandler: vi.fn(),
  updateHoveredTileAtScreenPoint: vi.fn(),
});

const projectWorldToScreenPoint = (camera: OrthographicCamera, world: Vector3) => {
  const projected = world.clone().project(camera);

  return {
    x: (projected.x + 1) * 0.5 * VIEWPORT_SIZE.width,
    y: (1 - projected.y) * 0.5 * VIEWPORT_SIZE.height,
  };
};

const intersectMapPlaneAtScreenPoint = (
  camera: OrthographicCamera,
  screenX: number,
  screenY: number,
): Vector3 => {
  const ndc = new Vector2(
    (screenX / VIEWPORT_SIZE.width) * 2 - 1,
    -(screenY / VIEWPORT_SIZE.height) * 2 + 1,
  );
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const intersection = raycaster.ray.intersectPlane(MAP_PLANE, new Vector3());

  if (!intersection) {
    throw new Error('Expected screen point to intersect the map plane.');
  }

  return intersection;
};

const getCameraDistanceToWorldPoint = (camera: OrthographicCamera, world: Vector3): number =>
  -world.clone().applyMatrix4(camera.matrixWorldInverse).z;

describe('GameRenderer', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis.window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redraws the last rendered map when map render config changes at runtime', async () => {
    const mapLayer = createMapLayerStub();
    const sceneSetup = createSceneSetupStub();
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
    const mapLayer = createMapLayerStub();
    const sceneSetup = createSceneSetupStub();
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

  it('moves the camera for pan zoom and orbit without transforming the map root', async () => {
    const mapLayer = createMapLayerStub();
    const sceneSetup = createSceneSetupStub();
    const renderer = new GameRenderer({
      mapLayer,
      sceneSetupFactory: vi.fn(() => sceneSetup),
    });
    const canvas = globalThis.document.createElement('canvas');

    await renderer.init(canvas);
    renderer.renderMap(TEST_MAP);

    const initialCameraPosition = sceneSetup.camera.position.clone();
    const initialFrustumWidth = sceneSetup.camera.right - sceneSetup.camera.left;

    renderer.panByDragMovement(24, -16);

    expect(sceneSetup.camera.position.equals(initialCameraPosition)).toBe(false);
    expect(mapLayer.group.position.toArray()).toEqual([0, 0, 0]);
    expect(mapLayer.group.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(mapLayer.group.scale.toArray()).toEqual([1, 1, 1]);

    renderer.zoomByWheel(-1, 120, 80);

    expect(sceneSetup.camera.right - sceneSetup.camera.left).toBeLessThan(initialFrustumWidth);
    expect(mapLayer.group.scale.toArray()).toEqual([1, 1, 1]);

    renderer.setDebugCameraControlsEnabled(true);
    const preOrbitCameraPosition = sceneSetup.camera.position.clone();
    renderer.orbitByDragMovement(60, -20);

    expect(sceneSetup.camera.position.equals(preOrbitCameraPosition)).toBe(false);
    expect(mapLayer.group.position.toArray()).toEqual([0, 0, 0]);
    expect(mapLayer.group.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);

    renderer.destroy();
  });

  it('keeps the same world point under the cursor when zooming', async () => {
    const mapLayer = createMapLayerStub();
    const sceneSetup = createSceneSetupStub();
    const renderer = new GameRenderer({
      mapLayer,
      sceneSetupFactory: vi.fn(() => sceneSetup),
    });
    const canvas = globalThis.document.createElement('canvas');
    const anchorScreenX = 150;
    const anchorScreenY = 60;

    await renderer.init(canvas);

    const before = intersectMapPlaneAtScreenPoint(sceneSetup.camera, anchorScreenX, anchorScreenY);

    renderer.zoomByWheel(-1, anchorScreenX, anchorScreenY);

    const after = intersectMapPlaneAtScreenPoint(sceneSetup.camera, anchorScreenX, anchorScreenY);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(after.z).toBeCloseTo(before.z, 6);

    renderer.destroy();
  });

  it('keeps hover picking working after pan zoom and orbit camera changes', async () => {
    const sceneSetup = createSceneSetupStub();
    const renderer = new GameRenderer({
      mapLayer: new MapLayer(),
      sceneSetupFactory: vi.fn(() => sceneSetup),
    });
    const canvas = globalThis.document.createElement('canvas');
    const tileWorldPoint = new Vector3(100, 100, 0);
    let hoveredTileKey: string | null = null;

    renderer.setMapRenderConfig({
      elevation: {
        enabled: false,
      },
    });

    await renderer.init(canvas);
    renderer.setHoveredTileChangeHandler((hoveredTile) => {
      hoveredTileKey = hoveredTile?.key ?? null;
    });
    renderer.renderMap(HOVER_TEST_MAP);

    let screenPoint = projectWorldToScreenPoint(sceneSetup.camera, tileWorldPoint);
    renderer.updateHoveredTileFromScreenPoint(screenPoint.x, screenPoint.y);
    expect(hoveredTileKey).toBe('0,0');

    renderer.panByDragMovement(18, -12);
    screenPoint = projectWorldToScreenPoint(sceneSetup.camera, tileWorldPoint);
    renderer.updateHoveredTileFromScreenPoint(screenPoint.x, screenPoint.y);
    expect(hoveredTileKey).toBe('0,0');

    renderer.zoomByWheel(-1, screenPoint.x, screenPoint.y);
    renderer.setDebugCameraControlsEnabled(true);
    renderer.orbitByDragMovement(48, -24);
    screenPoint = projectWorldToScreenPoint(sceneSetup.camera, tileWorldPoint);
    renderer.updateHoveredTileFromScreenPoint(screenPoint.x, screenPoint.y);
    expect(hoveredTileKey).toBe('0,0');

    renderer.destroy();
  });

  it('keeps elevated world bounds within the camera near and far planes', async () => {
    const elevatedGroup = new Group();
    const elevatedMesh = new Mesh(
      new BoxGeometry(80, 80, 240),
      new MeshBasicMaterial({ color: 0xffffff }),
    );

    elevatedMesh.position.set(100, 100, 240);
    elevatedGroup.add(elevatedMesh);

    const mapLayer = createMapLayerStub(elevatedGroup);
    const sceneSetup = createSceneSetupStub();
    const renderer = new GameRenderer({
      mapLayer,
      sceneSetupFactory: vi.fn(() => sceneSetup),
    });
    const canvas = globalThis.document.createElement('canvas');

    await renderer.init(canvas);
    renderer.setDebugCameraControlsEnabled(true);
    renderer.orbitByDragMovement(72, -36);

    const bottomCornerDistance = getCameraDistanceToWorldPoint(
      sceneSetup.camera,
      new Vector3(60, 60, 120),
    );
    const topCornerDistance = getCameraDistanceToWorldPoint(
      sceneSetup.camera,
      new Vector3(140, 140, 360),
    );

    expect(bottomCornerDistance).toBeGreaterThan(sceneSetup.camera.near);
    expect(bottomCornerDistance).toBeLessThan(sceneSetup.camera.far);
    expect(topCornerDistance).toBeGreaterThan(sceneSetup.camera.near);
    expect(topCornerDistance).toBeLessThan(sceneSetup.camera.far);

    renderer.destroy();
  });
});
