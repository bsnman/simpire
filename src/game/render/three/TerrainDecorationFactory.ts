import { Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { axialToPixel } from '~/game/render/hexMath';
import type { HexKey } from '~/types/hex';
import type { ElevationType } from '~/base/elevation';
import type { GameMap } from '~/types/map';

type PopulateTerrainDecorationsOptions = {
  map: GameMap;
  targetGroup: Group;
  isStale: () => boolean;
};

const TERRAIN_MODEL_PATHS: Partial<Record<ElevationType, string>> = {
  hill: '/models/terrain/hill.glb',
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

export class TerrainDecorationFactory {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<ElevationType, Object3D>();
  private templateLoadPromise: Promise<void> | null = null;

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

    const scale = Math.max(1, map.tileSize) * 0.55;

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
      const seed = hashHexKey(key);
      const yaw = toUnitRandom(seed) * Math.PI * 2;
      const jitterX = (toUnitRandom(Math.imul(seed ^ 0x9e3779b9, 1664525)) - 0.5) * map.tileSize * 0.08;
      const jitterY = (toUnitRandom(Math.imul(seed ^ 0x85ebca6b, 22695477)) - 0.5) * map.tileSize * 0.08;

      instance.position.set(
        center.x + map.origin.x + jitterX,
        center.y + map.origin.y + jitterY,
        DECORATION_Z_OFFSET,
      );
      instance.rotation.set(0, 0, yaw);
      instance.scale.set(scale, scale, scale);
      targetGroup.add(instance);
    }
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
    ).then(() => undefined);

    return this.templateLoadPromise;
  }
}
