import { BufferGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { buildMapElevationObjectName } from '~/game/render/layers/mapLayerObjectNames';
import {
  TerrainDecorationFactory,
  type TerrainModelLoaderLike,
} from '~/game/render/three/TerrainDecorationFactory';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

const TEST_MAP: GameMap = {
  id: 'terrain-decoration-test-map',
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
    },
  },
};

type TemplateSceneResources = {
  geometry: BufferGeometry;
  material: MeshBasicMaterial;
  scene: Group;
  texture: Texture;
};

const createTemplateSceneResources = (): TemplateSceneResources => {
  const geometry = new BufferGeometry();
  const texture = new Texture();
  const material = new MeshBasicMaterial({
    map: texture,
  });
  const scene = new Group();

  scene.add(new Mesh(geometry, material));

  return {
    geometry,
    material,
    scene,
    texture,
  };
};

const createLoaderResponse = (scene: Group) =>
  ({
    scene,
    scenes: [scene],
  }) as Awaited<ReturnType<TerrainModelLoaderLike['loadAsync']>>;

describe('TerrainDecorationFactory', () => {
  it('uses deterministic scene object names and disposes loaded template resources on destroy', async () => {
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const hillGeometryDispose = vi.spyOn(hillResources.geometry, 'dispose');
    const hillMaterialDispose = vi.spyOn(hillResources.material, 'dispose');
    const hillTextureDispose = vi.spyOn(hillResources.texture, 'dispose');
    const mountainGeometryDispose = vi.spyOn(mountainResources.geometry, 'dispose');
    const mountainMaterialDispose = vi.spyOn(mountainResources.material, 'dispose');
    const mountainTextureDispose = vi.spyOn(mountainResources.texture, 'dispose');
    const loader: TerrainModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path.includes('hill')) {
          return createLoaderResponse(hillResources.scene);
        }

        return createLoaderResponse(mountainResources.scene);
      }),
    };
    const factory = new TerrainDecorationFactory(loader);
    const targetGroup = new Group();

    await factory.populateTerrainDecorations({
      map: TEST_MAP,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    expect(targetGroup.children).toHaveLength(1);
    expect(targetGroup.children[0]?.name).toBe(buildMapElevationObjectName(toHexKey(0, 0), 'hill'));

    factory.destroy();

    expect(hillGeometryDispose).toHaveBeenCalledOnce();
    expect(hillMaterialDispose).toHaveBeenCalledOnce();
    expect(hillTextureDispose).toHaveBeenCalledOnce();
    expect(mountainGeometryDispose).toHaveBeenCalledOnce();
    expect(mountainMaterialDispose).toHaveBeenCalledOnce();
    expect(mountainTextureDispose).toHaveBeenCalledOnce();
  });

  it('disposes late-loaded templates instead of retaining them after destroy', async () => {
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const hillGeometryDispose = vi.spyOn(hillResources.geometry, 'dispose');
    const hillMaterialDispose = vi.spyOn(hillResources.material, 'dispose');
    const mountainGeometryDispose = vi.spyOn(mountainResources.geometry, 'dispose');
    const mountainMaterialDispose = vi.spyOn(mountainResources.material, 'dispose');
    const pendingLoads = new Map<
      string,
      (value: Awaited<ReturnType<TerrainModelLoaderLike['loadAsync']>>) => void
    >();
    const loader: TerrainModelLoaderLike = {
      loadAsync: vi.fn(
        (path: string) =>
          new Promise<Awaited<ReturnType<TerrainModelLoaderLike['loadAsync']>>>((resolve) => {
            pendingLoads.set(path, resolve);
          }),
      ),
    };
    const factory = new TerrainDecorationFactory(loader);
    const targetGroup = new Group();
    const populatePromise = factory.populateTerrainDecorations({
      map: TEST_MAP,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    factory.destroy();
    pendingLoads.get('/models/terrain/hill-v2.1.glb')?.(createLoaderResponse(hillResources.scene));
    pendingLoads.get('/models/terrain/mountain.glb')?.(
      createLoaderResponse(mountainResources.scene),
    );
    await populatePromise;

    expect(targetGroup.children).toHaveLength(0);
    expect(hillGeometryDispose).toHaveBeenCalledOnce();
    expect(hillMaterialDispose).toHaveBeenCalledOnce();
    expect(mountainGeometryDispose).toHaveBeenCalledOnce();
    expect(mountainMaterialDispose).toHaveBeenCalledOnce();
  });
});
