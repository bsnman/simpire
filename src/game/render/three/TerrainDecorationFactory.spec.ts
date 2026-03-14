import { BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { tiles } from '~/base/tiles';
import { buildMapElevationObjectName } from '~/game/render/layers/mapLayerObjectNames';
import { GLTF_IMPORT_CORRECTION_ROTATION_X } from '~/game/render/three/modelOrientation';
import {
  TerrainDecorationFactory,
  type TerrainModelLoaderLike,
} from '~/game/render/three/TerrainDecorationFactory';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

const FLAT_MODEL_PATH = '/models/terrain/flatground-v1-source.glb';
const HILL_MODEL_PATH = '/models/terrain/hill-v5.glb';
const MOUNTAIN_MODEL_PATH = '/models/terrain/mountain-v5.glb';

const createTestMap = (elevation: 'flat' | 'hill' | 'mountain'): GameMap => ({
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
      elevation,
    },
  },
});

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
    const testMap = createTestMap('flat');
    const flatResources = createTemplateSceneResources();
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const flatGeometryDispose = vi.spyOn(flatResources.geometry, 'dispose');
    const flatMaterialDispose = vi.spyOn(flatResources.material, 'dispose');
    const flatTextureDispose = vi.spyOn(flatResources.texture, 'dispose');
    const hillGeometryDispose = vi.spyOn(hillResources.geometry, 'dispose');
    const hillMaterialDispose = vi.spyOn(hillResources.material, 'dispose');
    const hillTextureDispose = vi.spyOn(hillResources.texture, 'dispose');
    const mountainGeometryDispose = vi.spyOn(mountainResources.geometry, 'dispose');
    const mountainMaterialDispose = vi.spyOn(mountainResources.material, 'dispose');
    const mountainTextureDispose = vi.spyOn(mountainResources.texture, 'dispose');
    const loader: TerrainModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FLAT_MODEL_PATH) {
          return createLoaderResponse(flatResources.scene);
        }

        if (path === HILL_MODEL_PATH) {
          return createLoaderResponse(hillResources.scene);
        }

        if (path === MOUNTAIN_MODEL_PATH) {
          return createLoaderResponse(mountainResources.scene);
        }

        throw new Error(`Unexpected terrain model path: ${path}`);
      }),
    };
    const factory = new TerrainDecorationFactory(loader);
    const targetGroup = new Group();

    await factory.populateTerrainDecorations({
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    expect(targetGroup.children).toHaveLength(1);
    expect(targetGroup.children[0]?.name).toBe(buildMapElevationObjectName(toHexKey(0, 0), 'flat'));
    expect(Number.isFinite(targetGroup.children[0]?.position.x)).toBe(true);
    expect(Number.isFinite(targetGroup.children[0]?.position.y)).toBe(true);
    expect(targetGroup.children[0]?.position.z).toBe(1);
    expect(targetGroup.children[0]?.rotation.x).toBe(0);
    expect(targetGroup.children[0]?.rotation.y).toBe(0);
    expect(Number.isFinite(targetGroup.children[0]?.rotation.z)).toBe(true);
    expect(targetGroup.children[0]?.children[0]?.rotation.x).toBeCloseTo(
      GLTF_IMPORT_CORRECTION_ROTATION_X,
    );
    const flatMesh = targetGroup.children[0]?.getObjectByProperty('isMesh', true) as
      | Mesh
      | undefined;
    expect(Array.isArray(flatMesh?.material)).toBe(false);
    expect((flatMesh?.material as MeshBasicMaterial | undefined)?.side).not.toBe(DoubleSide);

    factory.destroy();

    expect(flatGeometryDispose).toHaveBeenCalledOnce();
    expect(flatMaterialDispose).toHaveBeenCalledOnce();
    expect(flatTextureDispose).toHaveBeenCalledOnce();
    expect(hillGeometryDispose).toHaveBeenCalledOnce();
    expect(hillMaterialDispose).toHaveBeenCalledOnce();
    expect(hillTextureDispose).toHaveBeenCalledOnce();
    expect(mountainGeometryDispose).toHaveBeenCalledOnce();
    expect(mountainMaterialDispose).toHaveBeenCalledOnce();
    expect(mountainTextureDispose).toHaveBeenCalledOnce();
  });

  it('uses terrain-tinted materials for flat ground', async () => {
    const testMap = createTestMap('flat');
    const flatResources = createTemplateSceneResources();
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const loader: TerrainModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FLAT_MODEL_PATH) {
          return createLoaderResponse(flatResources.scene);
        }

        if (path === HILL_MODEL_PATH) {
          return createLoaderResponse(hillResources.scene);
        }

        if (path === MOUNTAIN_MODEL_PATH) {
          return createLoaderResponse(mountainResources.scene);
        }

        throw new Error(`Unexpected terrain model path: ${path}`);
      }),
    };
    const factory = new TerrainDecorationFactory(loader);
    const targetGroup = new Group();
    const expectedFlatTint = new Color(tiles.grassland.color)
      .offsetHSL(0, -0.08, -0.08)
      .getHexString();

    await factory.populateTerrainDecorations({
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    const flatMesh = targetGroup.children[0]?.getObjectByProperty('isMesh', true) as
      | Mesh
      | undefined;
    const flatMaterial = flatMesh?.material as MeshBasicMaterial | undefined;

    expect(Array.isArray(flatMesh?.material)).toBe(false);
    expect(flatMaterial?.side).not.toBe(DoubleSide);
    expect(flatMaterial?.color.getHexString()).toBe(expectedFlatTint);
  });

  it('uses double-sided terrain-tinted materials for mountains', async () => {
    const testMap = createTestMap('mountain');
    const flatResources = createTemplateSceneResources();
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const loader: TerrainModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FLAT_MODEL_PATH) {
          return createLoaderResponse(flatResources.scene);
        }

        if (path === HILL_MODEL_PATH) {
          return createLoaderResponse(hillResources.scene);
        }

        if (path === MOUNTAIN_MODEL_PATH) {
          return createLoaderResponse(mountainResources.scene);
        }

        throw new Error(`Unexpected terrain model path: ${path}`);
      }),
    };
    const factory = new TerrainDecorationFactory(loader);
    const targetGroup = new Group();
    const expectedMountainTint = new Color(tiles.grassland.color)
      .offsetHSL(0, -0.08, -0.08)
      .getHexString();

    await factory.populateTerrainDecorations({
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    const mountainMesh = targetGroup.children[0]?.getObjectByProperty('isMesh', true) as
      | Mesh
      | undefined;
    const mountainMaterial = mountainMesh?.material as MeshBasicMaterial | undefined;

    expect(Array.isArray(mountainMesh?.material)).toBe(false);
    expect(mountainMaterial?.side).toBe(DoubleSide);
    expect(mountainMaterial?.color.getHexString()).toBe(expectedMountainTint);
  });

  it('disposes late-loaded templates instead of retaining them after destroy', async () => {
    const testMap = createTestMap('hill');
    const flatResources = createTemplateSceneResources();
    const hillResources = createTemplateSceneResources();
    const mountainResources = createTemplateSceneResources();
    const flatGeometryDispose = vi.spyOn(flatResources.geometry, 'dispose');
    const flatMaterialDispose = vi.spyOn(flatResources.material, 'dispose');
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
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    factory.destroy();
    pendingLoads.get(FLAT_MODEL_PATH)?.(createLoaderResponse(flatResources.scene));
    pendingLoads.get(HILL_MODEL_PATH)?.(createLoaderResponse(hillResources.scene));
    pendingLoads.get(MOUNTAIN_MODEL_PATH)?.(createLoaderResponse(mountainResources.scene));
    await populatePromise;

    expect(targetGroup.children).toHaveLength(0);
    expect(flatGeometryDispose).toHaveBeenCalledOnce();
    expect(flatMaterialDispose).toHaveBeenCalledOnce();
    expect(hillGeometryDispose).toHaveBeenCalledOnce();
    expect(hillMaterialDispose).toHaveBeenCalledOnce();
    expect(mountainGeometryDispose).toHaveBeenCalledOnce();
    expect(mountainMaterialDispose).toHaveBeenCalledOnce();
  });
});
