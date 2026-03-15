import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { buildMapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import {
  buildMapTerrainFeatureBatchGroupName,
  buildMapTerrainFeatureBatchMeshObjectName,
} from '~/game/render/layers/mapLayerObjectNames';
import {
  TerrainFeatureDecorationFactory,
  type TerrainFeatureModelLoaderLike,
} from '~/game/render/three/TerrainFeatureDecorationFactory';
import { toHexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

const FOREST_MODEL_PATH = '/models/terrain-features/forest-pine-v1-source.glb';

const createTestMap = (elevation: 'flat' | 'hill', terrainFeatureId: 'forest' | 'jungle') =>
  ({
    id: `terrain-feature-${elevation}-${terrainFeatureId}`,
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
        terrainFeatureId,
      },
    },
  }) satisfies GameMap;

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
  }) as Awaited<ReturnType<TerrainFeatureModelLoaderLike['loadAsync']>>;

const getFirstInstancedMesh = (targetGroup: Group): InstancedMesh => {
  const mesh = targetGroup.children[0]?.children[0];

  if (!(mesh instanceof InstancedMesh)) {
    throw new Error('Expected first terrain-feature batch child to be an InstancedMesh.');
  }

  return mesh;
};

const collectInstanceMatrices = (instancedMesh: InstancedMesh): number[][] => {
  const matrix = new Matrix4();
  const matrices: number[][] = [];

  for (let index = 0; index < instancedMesh.count; index += 1) {
    instancedMesh.getMatrixAt(index, matrix);
    matrices.push(matrix.toArray());
  }

  return matrices;
};

describe('TerrainFeatureDecorationFactory', () => {
  it('renders deterministic forest batches on flat tiles', async () => {
    const testMap = createTestMap('flat', 'forest');
    const forestResources = createTemplateSceneResources();
    const loader: TerrainFeatureModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FOREST_MODEL_PATH) {
          return createLoaderResponse(forestResources.scene);
        }

        throw new Error(`Unexpected terrain feature model path: ${path}`);
      }),
    };
    const factory = new TerrainFeatureDecorationFactory(loader);
    const targetGroup = new Group();
    const tileRenderData = buildMapTileRenderData(testMap);

    await factory.populateTerrainFeatureDecorations({
      map: testMap,
      tileRenderData,
      targetGroup,
      terrainFeatureConfig: {
        enabled: true,
        instancesPerTile: 4,
        scaleMultiplier: 1,
        featureOverrides: {},
      },
      elevationConfig: {
        enabled: true,
        zOffset: 0.1,
        scaleMultiplier: 1.15,
      },
      isStale: () => false,
    });

    expect(targetGroup.children).toHaveLength(1);
    expect(targetGroup.children[0]?.name).toBe(buildMapTerrainFeatureBatchGroupName('forest'));
    expect(targetGroup.children[0]?.children[0]?.name).toBe(
      buildMapTerrainFeatureBatchMeshObjectName('forest', 0),
    );

    const instancedMesh = getFirstInstancedMesh(targetGroup);

    expect(instancedMesh.count).toBe(4);
    expect(instancedMesh.userData.instanceMetadata).toEqual([
      {
        batchInstanceIndex: 0,
        tileKey: toHexKey(0, 0),
        terrainFeatureId: 'forest',
        instanceIndex: 0,
      },
      {
        batchInstanceIndex: 1,
        tileKey: toHexKey(0, 0),
        terrainFeatureId: 'forest',
        instanceIndex: 1,
      },
      {
        batchInstanceIndex: 2,
        tileKey: toHexKey(0, 0),
        terrainFeatureId: 'forest',
        instanceIndex: 2,
      },
      {
        batchInstanceIndex: 3,
        tileKey: toHexKey(0, 0),
        terrainFeatureId: 'forest',
        instanceIndex: 3,
      },
    ]);

    const rerenderGroup = new Group();
    await factory.populateTerrainFeatureDecorations({
      map: testMap,
      tileRenderData,
      targetGroup: rerenderGroup,
      terrainFeatureConfig: {
        enabled: true,
        instancesPerTile: 4,
        scaleMultiplier: 1,
        featureOverrides: {},
      },
      elevationConfig: {
        enabled: false,
        zOffset: 0.1,
        scaleMultiplier: 1.15,
      },
      isStale: () => false,
    });

    expect(collectInstanceMatrices(getFirstInstancedMesh(rerenderGroup))).toEqual(
      collectInstanceMatrices(instancedMesh),
    );
  });

  it('places hill forest instances at varied higher z positions', async () => {
    const testMap = createTestMap('hill', 'forest');
    const forestResources = createTemplateSceneResources();
    const loader: TerrainFeatureModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FOREST_MODEL_PATH) {
          return createLoaderResponse(forestResources.scene);
        }

        throw new Error(`Unexpected terrain feature model path: ${path}`);
      }),
    };
    const factory = new TerrainFeatureDecorationFactory(loader);
    const targetGroup = new Group();
    const matrix = new Matrix4();

    await factory.populateTerrainFeatureDecorations({
      map: testMap,
      tileRenderData: buildMapTileRenderData(testMap),
      targetGroup,
      terrainFeatureConfig: {
        enabled: true,
        instancesPerTile: 4,
        scaleMultiplier: 1,
        featureOverrides: {},
      },
      elevationConfig: {
        enabled: false,
        zOffset: 0.1,
        scaleMultiplier: 1.15,
      },
      isStale: () => false,
    });

    const instancedMesh = getFirstInstancedMesh(targetGroup);
    const zValues = Array.from({ length: instancedMesh.count }, (_, index) => {
      instancedMesh.getMatrixAt(index, matrix);
      return matrix.elements[14] ?? 0;
    });

    expect(zValues).toHaveLength(4);
    expect(Math.min(...zValues)).toBeGreaterThan(0.1);
    expect(new Set(zValues).size).toBeGreaterThan(1);
  });

  it('skips terrain features without a renderer definition', async () => {
    const testMap = createTestMap('flat', 'jungle');
    const forestResources = createTemplateSceneResources();
    const loader: TerrainFeatureModelLoaderLike = {
      loadAsync: vi.fn(async (path: string) => {
        if (path === FOREST_MODEL_PATH) {
          return createLoaderResponse(forestResources.scene);
        }

        throw new Error(`Unexpected terrain feature model path: ${path}`);
      }),
    };
    const factory = new TerrainFeatureDecorationFactory(loader);
    const targetGroup = new Group();

    await factory.populateTerrainFeatureDecorations({
      map: testMap,
      tileRenderData: buildMapTileRenderData(testMap),
      targetGroup,
      terrainFeatureConfig: {
        enabled: true,
        instancesPerTile: 4,
        scaleMultiplier: 1,
        featureOverrides: {},
      },
      elevationConfig: {
        enabled: true,
        zOffset: 0.1,
        scaleMultiplier: 1.15,
      },
      isStale: () => false,
    });

    expect(targetGroup.children).toHaveLength(0);
  });

  it('disposes loaded templates on destroy and drops late async loads', async () => {
    const testMap = createTestMap('flat', 'forest');
    const forestResources = createTemplateSceneResources();
    const geometryDispose = vi.spyOn(forestResources.geometry, 'dispose');
    const materialDispose = vi.spyOn(forestResources.material, 'dispose');
    const textureDispose = vi.spyOn(forestResources.texture, 'dispose');
    const pendingLoads = new Map<
      string,
      (value: Awaited<ReturnType<TerrainFeatureModelLoaderLike['loadAsync']>>) => void
    >();
    const loader: TerrainFeatureModelLoaderLike = {
      loadAsync: vi.fn(
        (path: string) =>
          new Promise<Awaited<ReturnType<TerrainFeatureModelLoaderLike['loadAsync']>>>((resolve) => {
            pendingLoads.set(path, resolve);
          }),
      ),
    };
    const factory = new TerrainFeatureDecorationFactory(loader);
    const targetGroup = new Group();
    const populatePromise = factory.populateTerrainFeatureDecorations({
      map: testMap,
      tileRenderData: buildMapTileRenderData(testMap),
      targetGroup,
      terrainFeatureConfig: {
        enabled: true,
        instancesPerTile: 4,
        scaleMultiplier: 1,
        featureOverrides: {},
      },
      elevationConfig: {
        enabled: true,
        zOffset: 0.1,
        scaleMultiplier: 1.15,
      },
      isStale: () => false,
    });

    factory.destroy();
    pendingLoads.get(FOREST_MODEL_PATH)?.(createLoaderResponse(forestResources.scene));
    await populatePromise;

    expect(targetGroup.children).toHaveLength(0);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });
});
