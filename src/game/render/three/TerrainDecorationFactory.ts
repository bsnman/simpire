import {
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
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

import { tiles } from '~/base/tiles';
import type { ElevationType } from '~/base/elevation';
import {
  buildMapElevationBatchGroupName,
  buildMapElevationBatchMeshObjectName,
} from '~/game/render/layers/mapLayerObjectNames';
import { axialToPixel } from '~/game/render/hexMath';
import { orientImportedGltfRoot } from '~/game/render/three/modelOrientation';
import {
  extractInstancedTemplateParts,
  type InstancedTemplateMaterial,
  type InstancedTemplatePart,
} from '~/game/render/three/instancedModelTemplate';
import type { HexKey } from '~/types/hex';
import type { GameMap, MapTile } from '~/types/map';

type PopulateTerrainDecorationsOptions = {
  map: GameMap;
  targetGroup: Group;
  isStale: () => boolean;
  zOffset: number;
  scaleMultiplier: number;
};

const TERRAIN_MODEL_PATHS: Partial<Record<ElevationType, string>> = {
  flat: '/models/terrain/flatground-v1-source.glb',
  hill: '/models/terrain/hill-v5.glb',
  mountain: '/models/terrain/mountain-v5.glb',
};

type ResourceDisposalTracker = {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
  textures: Set<Texture>;
};

type TerrainTemplate = {
  root: Object3D;
  parts: readonly InstancedTemplatePart[];
};

type TerrainBatchInstance = {
  matrix: Matrix4;
  tint: Color;
  tileKey: HexKey;
};

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

const buildTerrainTint = (tile: MapTile): Color => {
  const tint = new Color(tiles[tile.terrain].color);
  return tint.offsetHSL(0, -0.08, -0.08);
};

const hashHexKey = (key: HexKey): number => {
  let hash = 2166136261;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const toUnitRandom = (seed: number): number => seed / 0xffffffff;

const updateTerrainTemplateMaterial = (
  material: InstancedTemplateMaterial,
  elevation: ElevationType,
) => {
  const side = elevation === 'flat' ? FrontSide : DoubleSide;
  const materials = Array.isArray(material) ? material : [material];

  materials.forEach((entry) => {
    entry.side = side;
    const tintableMaterial = entry as Material & {
      color?: Color;
      vertexColors?: boolean;
    };

    if (tintableMaterial.color?.isColor) {
      tintableMaterial.color.set(0xffffff);
    }

    if ('vertexColors' in tintableMaterial) {
      tintableMaterial.vertexColors = true;
    }
  });
};

export type TerrainModelLoaderLike = Pick<GLTFLoader, 'loadAsync'>;

export class TerrainDecorationFactory {
  private readonly loader: TerrainModelLoaderLike;
  private readonly templates = new Map<ElevationType, TerrainTemplate>();
  private templateLoadPromise: Promise<void> | null = null;
  private hasLoggedLoadError = false;
  private templateLifetimeToken = 0;
  private destroyed = false;

  constructor(loader: TerrainModelLoaderLike = new GLTFLoader()) {
    this.loader = loader;
  }

  async populateTerrainDecorations({
    map,
    targetGroup,
    isStale,
    zOffset,
    scaleMultiplier,
  }: PopulateTerrainDecorationsOptions): Promise<void> {
    targetGroup.clear();
    await this.ensureTemplatesLoaded();

    if (isStale()) {
      return;
    }

    const scale = Math.max(1, map.tileSize) * scaleMultiplier;
    const batchInstances = new Map<ElevationType, TerrainBatchInstance[]>();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scaleVector = new Vector3(scale, scale, scale);

    for (const key of map.tileKeys) {
      if (isStale()) {
        return;
      }

      const tile = map.tilesByKey[key];

      if (!tile) {
        continue;
      }

      const template = this.templates.get(tile.elevation);

      if (!template) {
        continue;
      }

      const center = axialToPixel({ q: tile.q, r: tile.r }, map.tileSize, map.layout);
      const seed = hashHexKey(key);
      const jitterX =
        (toUnitRandom(Math.imul(seed ^ 0x9e3779b9, 1664525)) - 0.5) * map.tileSize * 0.08;
      const jitterY =
        (toUnitRandom(Math.imul(seed ^ 0x85ebca6b, 22695477)) - 0.5) * map.tileSize * 0.08;

      position.set(center.x + map.origin.x + jitterX, center.y + map.origin.y + jitterY, zOffset);
      rotation.identity();

      const instanceMatrix = new Matrix4().compose(position.clone(), rotation.clone(), scaleVector);
      const instances = batchInstances.get(tile.elevation) ?? [];

      instances.push({
        matrix: instanceMatrix,
        tint: buildTerrainTint(tile),
        tileKey: key,
      });
      batchInstances.set(tile.elevation, instances);
    }

    batchInstances.forEach((instances, elevation) => {
      const template = this.templates.get(elevation);

      if (!template || !instances.length) {
        return;
      }

      const batchGroup = new Group();
      const combinedMatrix = new Matrix4();

      batchGroup.name = buildMapElevationBatchGroupName(elevation);

      template.parts.forEach((part, meshIndex) => {
        const instancedMesh = new InstancedMesh(part.geometry, part.material, instances.length);

        instancedMesh.name = buildMapElevationBatchMeshObjectName(elevation, meshIndex);
        instancedMesh.renderOrder = part.renderOrder;
        instancedMesh.userData.instanceMetadata = instances.map((instance, instanceIndex) => ({
          instanceId: instanceIndex,
          tileKey: instance.tileKey,
          elevation,
        }));

        instances.forEach((instance, instanceIndex) => {
          combinedMatrix.multiplyMatrices(instance.matrix, part.matrixWorld);
          instancedMesh.setMatrixAt(instanceIndex, combinedMatrix);
          instancedMesh.setColorAt(instanceIndex, instance.tint);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) {
          instancedMesh.instanceColor.needsUpdate = true;
        }

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
    const entries = Object.entries(TERRAIN_MODEL_PATHS) as [ElevationType, string][];
    const loadedTemplates = new Map<ElevationType, TerrainTemplate>();

    this.templateLoadPromise = Promise.allSettled(
      entries.map(async ([elevation, path]) => {
        const gltf = await this.loader.loadAsync(path);
        const root = gltf.scene || gltf.scenes[0];

        if (!root) {
          return;
        }

        const orientedRoot = orientImportedGltfRoot(root);
        const parts = extractInstancedTemplateParts(orientedRoot);

        parts.forEach((part) => updateTerrainTemplateMaterial(part.material, elevation));
        loadedTemplates.set(elevation, {
          root: orientedRoot,
          parts,
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
            console.error('Failed to load terrain decoration models.', firstRejectedResult.reason);
          }
          return;
        }

        loadedTemplates.forEach((template, elevation) => {
          this.templates.set(elevation, template);
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
