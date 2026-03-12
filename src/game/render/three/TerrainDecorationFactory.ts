import { Color, Group, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { tiles } from '~/base/tiles';
import { axialToPixel } from '~/game/render/hexMath';
import type { HexKey } from '~/types/hex';
import type { ElevationType } from '~/base/elevation';
import type { GameMap, MapTile } from '~/types/map';

type PopulateTerrainDecorationsOptions = {
  map: GameMap;
  targetGroup: Group;
  isStale: () => boolean;
};

const TERRAIN_MODEL_PATHS: Partial<Record<ElevationType, string>> = {
  hill: '/models/terrain/hill-v2.glb',
  mountain: '/models/terrain/mountain.glb',
};

const DECORATION_Z_OFFSET = 0.08;

const hashHexKey = (key: HexKey): number => {
  let hash = 2166136261;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const toUnitRandom = (seed: number): number => seed / 0xffffffff;

const cloneModelTemplate = (template: Object3D): Object3D => template.clone(true);
const MOUNTAIN_ROCK_TINT = '#7b7f85';

const buildTerrainTint = (tile: MapTile): Color => {
  if (tile.elevation === 'mountain') {
    return new Color(MOUNTAIN_ROCK_TINT);
  }

  const tint = new Color(tiles[tile.terrain].color);
  return tint.offsetHSL(0, -0.08, -0.08);
};

export class TerrainDecorationFactory {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<ElevationType, Object3D>();
  private readonly tintedMaterialCache = new Map<Material, Map<string, Material>>();
  private templateLoadPromise: Promise<void> | null = null;
  private hasLoggedLoadError = false;

  async populateTerrainDecorations({
    map,
    targetGroup,
    isStale,
  }: PopulateTerrainDecorationsOptions): Promise<void> {
    targetGroup.clear();
    await this.ensureTemplatesLoaded();

    if (isStale()) {
      return;
    }

    const scale = Math.max(1, map.tileSize) * 0.75;

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
      const instance = cloneModelTemplate(template);
      const terrainTint = buildTerrainTint(tile);
      const seed = hashHexKey(key);
      const yaw = toUnitRandom(seed) * Math.PI * 2;
      const jitterX =
        (toUnitRandom(Math.imul(seed ^ 0x9e3779b9, 1664525)) - 0.5) * map.tileSize * 0.08;
      const jitterY =
        (toUnitRandom(Math.imul(seed ^ 0x85ebca6b, 22695477)) - 0.5) * map.tileSize * 0.08;

      instance.position.set(
        center.x + map.origin.x + jitterX,
        center.y + map.origin.y + jitterY,
        DECORATION_Z_OFFSET,
      );
      instance.rotation.set(0, 0, yaw);
      instance.scale.set(scale, scale, scale);
      this.applyTerrainTint(instance, terrainTint);
      targetGroup.add(instance);
    }
  }

  destroy() {
    this.templates.clear();
    this.tintedMaterialCache.forEach((tintedMaterialsByColor) => {
      tintedMaterialsByColor.forEach((material) => material.dispose());
      tintedMaterialsByColor.clear();
    });
    this.tintedMaterialCache.clear();
  }

  private ensureTemplatesLoaded(): Promise<void> {
    if (this.templateLoadPromise) {
      return this.templateLoadPromise;
    }

    const entries = Object.entries(TERRAIN_MODEL_PATHS) as [ElevationType, string][];

    this.templateLoadPromise = Promise.all(
      entries.map(async ([elevation, path]) => {
        const gltf = await this.loader.loadAsync(path);
        const root = gltf.scene || gltf.scenes[0];

        if (!root) {
          return;
        }

        root.updateMatrixWorld(true);
        this.templates.set(elevation, root);
      }),
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        if (!this.hasLoggedLoadError) {
          this.hasLoggedLoadError = true;
          console.error('Failed to load terrain decoration models.', error);
        }
      });

    return this.templateLoadPromise;
  }

  private applyTerrainTint(instance: Object3D, tint: Color) {
    instance.traverse((node) => {
      const mesh = node as Mesh;

      if (!mesh.isMesh) {
        return;
      }

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => this.getTintedMaterial(material, tint));
        return;
      }

      mesh.material = this.getTintedMaterial(mesh.material, tint);
    });
  }

  private getTintedMaterial(baseMaterial: Material, tint: Color): Material {
    const tintKey = tint.getHexString();
    const tintedMaterialsByColor = this.tintedMaterialCache.get(baseMaterial);

    if (tintedMaterialsByColor?.has(tintKey)) {
      return tintedMaterialsByColor.get(tintKey) ?? baseMaterial;
    }

    const tinted = baseMaterial.clone();
    const tintedWithColor = tinted as Material & { color?: Color };

    if (tintedWithColor.color?.isColor) {
      tintedWithColor.color.copy(tint);
    }

    const cache = tintedMaterialsByColor ?? new Map<string, Material>();
    cache.set(tintKey, tinted);

    if (!tintedMaterialsByColor) {
      this.tintedMaterialCache.set(baseMaterial, cache);
    }

    return tinted;
  }
}
