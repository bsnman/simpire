import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  FrontSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { tiles } from '~/base/tiles';
import {
  buildMapElevationBatchGroupName,
  buildMapElevationBatchMeshObjectName,
} from '~/game/render/layers/mapLayerObjectNames';
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

const getFirstInstancedMesh = (targetGroup: Group): InstancedMesh => {
  const mesh = targetGroup.children[0]?.children[0];

  if (!(mesh instanceof InstancedMesh)) {
    throw new Error('Expected first batch child to be an InstancedMesh.');
  }

  return mesh;
};

describe('TerrainDecorationFactory', () => {
  it('renders elevation batches with stable names and disposes loaded template resources on destroy', async () => {
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
    expect(targetGroup.children[0]?.name).toBe(buildMapElevationBatchGroupName('flat'));
    expect(targetGroup.children[0]?.children).toHaveLength(1);
    expect(targetGroup.children[0]?.children[0]?.name).toBe(
      buildMapElevationBatchMeshObjectName('flat', 0),
    );

    const instancedMesh = getFirstInstancedMesh(targetGroup);
    const instanceMatrix = new Matrix4();
    const instancePosition = new Vector3();
    const instanceQuaternion = new Quaternion();
    const instanceScale = new Vector3();

    instancedMesh.getMatrixAt(0, instanceMatrix);
    instanceMatrix.decompose(instancePosition, instanceQuaternion, instanceScale);

    expect(instancedMesh.count).toBe(1);
    expect(instancePosition.z).toBeCloseTo(1, 6);
    expect(Number.isFinite(instancePosition.x)).toBe(true);
    expect(Number.isFinite(instancePosition.y)).toBe(true);
    expect(instanceScale.x).toBeCloseTo(testMap.tileSize * 0.75, 6);
    expect((instancedMesh.material as MeshBasicMaterial).side).toBe(FrontSide);

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

  it('uses per-instance tint colors for flat ground batches', async () => {
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
    const instanceColor = new Color();

    await factory.populateTerrainDecorations({
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    const instancedMesh = getFirstInstancedMesh(targetGroup);

    instancedMesh.getColorAt(0, instanceColor);

    expect(instanceColor.getHexString()).toBe(expectedFlatTint);
    expect((instancedMesh.material as MeshBasicMaterial).side).toBe(FrontSide);
  });

  it('uses fixed-orientation double-sided batches for mountains', async () => {
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
    const instanceMatrix = new Matrix4();
    const instancePosition = new Vector3();
    const instanceQuaternion = new Quaternion();
    const instanceScale = new Vector3();

    await factory.populateTerrainDecorations({
      map: testMap,
      targetGroup,
      zOffset: 1,
      scaleMultiplier: 0.75,
      isStale: () => false,
    });

    const instancedMesh = getFirstInstancedMesh(targetGroup);

    instancedMesh.getMatrixAt(0, instanceMatrix);
    instanceMatrix.decompose(instancePosition, instanceQuaternion, instanceScale);

    expect((instancedMesh.material as MeshBasicMaterial).side).toBe(DoubleSide);
    expect(new Euler().setFromQuaternion(instanceQuaternion).z).toBeCloseTo(0, 6);
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
