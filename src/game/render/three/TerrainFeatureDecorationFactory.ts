import {
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Texture,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { ElevationType } from '~/base/elevation';
import type { TerrainFeatureType } from '~/base/terrainFeatures';
import type { MapTileRenderData } from '~/game/render/layers/mapTileRenderData';
import {
  buildMapTerrainFeatureBatchGroupName,
  buildMapTerrainFeatureBatchMeshObjectName,
} from '~/game/render/layers/mapLayerObjectNames';
import type {
  ElevationLayerConfig,
  TerrainFeatureLayerConfig,
  TerrainFeatureLayerFeatureOverride,
} from '~/game/render/mapRenderConfig';
import { orientImportedGltfRoot } from '~/game/render/three/modelOrientation';
import {
  extractInstancedTemplateParts,
  type InstancedTemplatePart,
} from '~/game/render/three/instancedModelTemplate';
import {
  terrainFeatureRenderDefinitions,
  type TerrainFeatureAnchor,
  type TerrainFeatureRenderDefinition,
} from '~/game/render/three/terrainFeatureRenderDefinitions';
import type { HexKey } from '~/types/hex';
import type { GameMap } from '~/types/map';

type PopulateTerrainFeatureDecorationsOptions = {
  map: GameMap;
  tileRenderData: ReadonlyArray<MapTileRenderData>;
  targetGroup: Group;
  terrainFeatureConfig: TerrainFeatureLayerConfig;
  elevationConfig: ElevationLayerConfig;
  isStale: () => boolean;
};

type ResourceDisposalTracker = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
  textures: Set<Texture>;
};

type TerrainFeatureTemplate = {
  root: Object3D;
  parts: readonly InstancedTemplatePart[];
};

type TerrainFeatureBatchInstance = {
  matrix: Matrix4;
  tileKey: HexKey;
  terrainFeatureId: TerrainFeatureType;
  instanceIndex: number;
};

export type TerrainFeatureModelLoaderLike = Pick<GLTFLoader, 'loadAsync'>;
const Z_AXIS = new Vector3(0, 0, 1);

const createResourceDisposalTracker = (): ResourceDisposalTracker => ({
  geometries: new Set<BufferGeometry>(),
  materials: new Set<Material>(),
  textures: new Set<Texture>(),
});

const disposeMaterialResources = (material: Material, disposalTracker: ResourceDisposalTracker) => {
  if (disposalTracker.materials.has(material)) {
    return;
  }

  disposalTracker.materials.add(material);

  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    const texture = value as Texture & { isTexture?: boolean };

    if (!texture?.isTexture || disposalTracker.textures.has(texture)) {
      continue;
    }

    disposalTracker.textures.add(texture);
    texture.dispose();
  }

  material.dispose();
};

const disposeObject3DResources = (object: Object3D, disposalTracker: ResourceDisposalTracker) => {
  object.traverse((node) => {
    const mesh = node as Mesh;

    if (!mesh.isMesh) {
      return;
    }

    const geometry = mesh.geometry as BufferGeometry | undefined;

    if (geometry && !disposalTracker.geometries.has(geometry)) {
      disposalTracker.geometries.add(geometry);
      geometry.dispose();
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => disposeMaterialResources(material, disposalTracker));
      return;
    }

    disposeMaterialResources(mesh.material, disposalTracker);
  });
};

const hashString = (value: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const mixSeed = (seed: number, salt: number): number => Math.imul(seed ^ salt, 2246822519) >>> 0;

const toUnitRandom = (seed: number): number => seed / 0xffffffff;

const getRenderDefinition = (
  terrainFeatureId: TerrainFeatureType,
): TerrainFeatureRenderDefinition | null =>
  terrainFeatureRenderDefinitions[terrainFeatureId] ?? null;

const getFeatureAnchors = (
  terrainFeatureId: TerrainFeatureType,
  elevation: ElevationType,
): readonly TerrainFeatureAnchor[] => {
  const definition = getRenderDefinition(terrainFeatureId);

  if (!definition) {
    return [];
  }

  return definition.anchorsByElevation[elevation] ?? [];
};

const getFeatureOverride = (
  terrainFeatureConfig: TerrainFeatureLayerConfig,
  terrainFeatureId: TerrainFeatureType,
): TerrainFeatureLayerFeatureOverride =>
  terrainFeatureConfig.featureOverrides[terrainFeatureId] ?? {};

const resolveInstanceCount = (
  terrainFeatureConfig: TerrainFeatureLayerConfig,
  terrainFeatureId: TerrainFeatureType,
  anchorCount: number,
): number => {
  const override = getFeatureOverride(terrainFeatureConfig, terrainFeatureId);
  const configuredCount = override.instancesPerTile ?? terrainFeatureConfig.instancesPerTile;

  return Math.max(0, Math.min(anchorCount, Math.floor(configuredCount)));
};

const isFeatureEnabled = (
  terrainFeatureConfig: TerrainFeatureLayerConfig,
  terrainFeatureId: TerrainFeatureType,
): boolean => {
  const override = getFeatureOverride(terrainFeatureConfig, terrainFeatureId);
  return override.enabled ?? true;
};

const resolveFeatureScale = (
  tileSize: number,
  terrainFeatureConfig: TerrainFeatureLayerConfig,
  terrainFeatureId: TerrainFeatureType,
): number => {
  const definition = getRenderDefinition(terrainFeatureId);

  if (!definition) {
    return 0;
  }

  const override = getFeatureOverride(terrainFeatureConfig, terrainFeatureId);
  const scaleMultiplier = override.scaleMultiplier ?? terrainFeatureConfig.scaleMultiplier;

  return Math.max(0, tileSize) * definition.baseScale * scaleMultiplier;
};

const selectAnchors = (
  terrainFeatureId: TerrainFeatureType,
  tileKey: HexKey,
  anchors: readonly TerrainFeatureAnchor[],
  count: number,
): TerrainFeatureAnchor[] =>
  anchors
    .map((anchor, anchorIndex) => ({
      anchor,
      orderSeed: hashString(`${tileKey}:${terrainFeatureId}:anchor:${anchorIndex}`),
    }))
    .sort((left, right) => left.orderSeed - right.orderSeed)
    .slice(0, count)
    .map((entry) => entry.anchor);

export class TerrainFeatureDecorationFactory {
  private readonly loader: TerrainFeatureModelLoaderLike;
  private readonly templates = new Map<TerrainFeatureType, TerrainFeatureTemplate>();
  private templateLoadPromise: Promise<void> | null = null;
  private hasLoggedLoadError = false;
  private templateLifetimeToken = 0;
  private destroyed = false;

  constructor(loader: TerrainFeatureModelLoaderLike = new GLTFLoader()) {
    this.loader = loader;
  }

  async populateTerrainFeatureDecorations({
    map,
    tileRenderData,
    targetGroup,
    terrainFeatureConfig,
    elevationConfig,
    isStale,
  }: PopulateTerrainFeatureDecorationsOptions): Promise<void> {
    targetGroup.clear();
    await this.ensureTemplatesLoaded();

    if (isStale()) {
      return;
    }

    const elevationScale = Math.max(1, map.tileSize) * elevationConfig.scaleMultiplier;
    const batchInstances = new Map<TerrainFeatureType, TerrainFeatureBatchInstance[]>();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scaleVector = new Vector3();

    for (const tileData of tileRenderData) {
      if (isStale()) {
        return;
      }

      const tile = tileData.tile;
      const terrainFeatureId = tile?.terrainFeatureId;

      if (!terrainFeatureId) {
        continue;
      }

      const definition = getRenderDefinition(terrainFeatureId);

      if (!definition || !isFeatureEnabled(terrainFeatureConfig, terrainFeatureId)) {
        continue;
      }

      const anchors = getFeatureAnchors(terrainFeatureId, tile.elevation);

      if (!anchors.length) {
        continue;
      }

      const instanceCount = resolveInstanceCount(
        terrainFeatureConfig,
        terrainFeatureId,
        anchors.length,
      );

      if (instanceCount <= 0 || !this.templates.has(terrainFeatureId)) {
        continue;
      }

      const scale = resolveFeatureScale(map.tileSize, terrainFeatureConfig, terrainFeatureId);

      if (scale <= 0) {
        continue;
      }

      const selectedAnchors = selectAnchors(terrainFeatureId, tileData.key, anchors, instanceCount);
      const instances = batchInstances.get(terrainFeatureId) ?? [];

      selectedAnchors.forEach((anchor, instanceIndex) => {
        const instanceSeed = hashString(`${tileData.key}:${terrainFeatureId}:${instanceIndex}`);
        const scaleVariation = 0.9 + toUnitRandom(mixSeed(instanceSeed, 0x9e3779b9)) * 0.2;
        const yaw = toUnitRandom(mixSeed(instanceSeed, 0x85ebca6b)) * Math.PI * 2;

        position.set(
          tileData.worldX + anchor.x * map.tileSize,
          tileData.worldY + anchor.y * map.tileSize,
          elevationConfig.zOffset + anchor.z * elevationScale,
        );
        rotation.setFromAxisAngle(Z_AXIS, yaw);
        scaleVector.setScalar(scale * scaleVariation);

        instances.push({
          matrix: new Matrix4().compose(position.clone(), rotation.clone(), scaleVector.clone()),
          tileKey: tileData.key,
          terrainFeatureId,
          instanceIndex,
        });
      });

      batchInstances.set(terrainFeatureId, instances);
    }

    batchInstances.forEach((instances, terrainFeatureId) => {
      const template = this.templates.get(terrainFeatureId);

      if (!template || !instances.length) {
        return;
      }

      const batchGroup = new Group();
      const combinedMatrix = new Matrix4();

      batchGroup.name = buildMapTerrainFeatureBatchGroupName(terrainFeatureId);

      template.parts.forEach((part, meshIndex) => {
        const instancedMesh = new InstancedMesh(part.geometry, part.material, instances.length);

        instancedMesh.name = buildMapTerrainFeatureBatchMeshObjectName(
          terrainFeatureId,
          meshIndex,
        );
        instancedMesh.renderOrder = part.renderOrder;
        instancedMesh.userData.instanceMetadata = instances.map((instance, batchInstanceIndex) => ({
          batchInstanceIndex,
          tileKey: instance.tileKey,
          terrainFeatureId: instance.terrainFeatureId,
          instanceIndex: instance.instanceIndex,
        }));

        instances.forEach((instance, batchInstanceIndex) => {
          combinedMatrix.multiplyMatrices(instance.matrix, part.matrixWorld);
          instancedMesh.setMatrixAt(batchInstanceIndex, combinedMatrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        batchGroup.add(instancedMesh);
      });

      targetGroup.add(batchGroup);
    });
  }

  destroy() {
    this.destroyed = true;
    this.templateLifetimeToken += 1;
    this.disposeTemplates();
    this.templateLoadPromise = null;
  }

  private ensureTemplatesLoaded(): Promise<void> {
    if (this.templates.size > 0) {
      return Promise.resolve();
    }

    if (this.templateLoadPromise) {
      return this.templateLoadPromise;
    }

    this.destroyed = false;
    const loadToken = this.templateLifetimeToken;
    const entries = Object.entries(terrainFeatureRenderDefinitions).filter(
      (entry): entry is [TerrainFeatureType, TerrainFeatureRenderDefinition] =>
        entry[1] !== undefined,
    );
    const loadedTemplates = new Map<TerrainFeatureType, TerrainFeatureTemplate>();

    this.templateLoadPromise = Promise.allSettled(
      entries.map(async ([terrainFeatureId, definition]) => {
        const gltf = await this.loader.loadAsync(definition.modelPath);
        const root = gltf.scene || gltf.scenes[0];

        if (!root) {
          return;
        }

        const orientedRoot = orientImportedGltfRoot(root);

        loadedTemplates.set(terrainFeatureId, {
          root: orientedRoot,
          parts: extractInstancedTemplateParts(orientedRoot),
        });
      }),
    )
      .then((results) => {
        const firstRejectedResult = results.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );
        const shouldDisposeLoadedTemplates =
          this.destroyed ||
          loadToken !== this.templateLifetimeToken ||
          Boolean(firstRejectedResult);

        if (shouldDisposeLoadedTemplates) {
          const disposalTracker = createResourceDisposalTracker();

          loadedTemplates.forEach((template) => {
            disposeObject3DResources(template.root, disposalTracker);
          });
          loadedTemplates.clear();
        }

        if (this.destroyed || loadToken !== this.templateLifetimeToken) {
          return;
        }

        if (firstRejectedResult) {
          if (!this.hasLoggedLoadError) {
            this.hasLoggedLoadError = true;
            console.error(
              'Failed to load terrain feature decoration models.',
              firstRejectedResult.reason,
            );
          }
          return;
        }

        loadedTemplates.forEach((template, terrainFeatureId) => {
          this.templates.set(terrainFeatureId, template);
        });
      })
      .finally(() => {
        if (loadToken === this.templateLifetimeToken) {
          this.templateLoadPromise = null;
        }
      });

    return this.templateLoadPromise;
  }

  private disposeTemplates() {
    const disposalTracker = createResourceDisposalTracker();

    this.templates.forEach((template) => {
      disposeObject3DResources(template.root, disposalTracker);
    });
    this.templates.clear();
  }
}
