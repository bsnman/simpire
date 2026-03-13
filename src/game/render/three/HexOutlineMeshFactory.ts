import {
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineLoop,
  type ColorRepresentation,
} from 'three';

import type { HexKey, HexLayout } from '~/types/hex';
import { buildMapHexOutlineObjectName } from '~/game/render/layers/mapLayerObjectNames';
import {
  buildHexGeometryCacheKey,
  createHexBorderGeometry,
  type HexGeometryCacheKey,
} from '~/game/render/three/hexGeometry';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';

export class HexOutlineMeshFactory {
  private readonly geometryCache = new Map<HexGeometryCacheKey, BufferGeometry>();
  private readonly materialCache = new Map<string, LineBasicMaterial>();

  createHexOutline(
    tileSize: number,
    layout: HexLayout,
    color: ColorRepresentation,
    tileKey: HexKey,
  ): LineLoop {
    const line = new LineLoop(
      this.getHexBorderGeometry(tileSize, layout),
      this.getOutlineMaterial(color),
    );

    line.name = buildMapHexOutlineObjectName(tileKey);
    line.userData[HEX_KEY_USER_DATA_FIELD] = tileKey;
    return line;
  }

  destroy() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();

    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
  }

  private getHexBorderGeometry(tileSize: number, layout: HexLayout): BufferGeometry {
    const cacheKey = buildHexGeometryCacheKey(layout, tileSize);
    const cached = this.geometryCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const geometry = createHexBorderGeometry(tileSize, layout);
    this.geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  private getOutlineMaterial(color: ColorRepresentation): LineBasicMaterial {
    const normalizedColor = new Color(color).getHexString();
    const cached = this.materialCache.get(normalizedColor);

    if (cached) {
      return cached;
    }

    const material = new LineBasicMaterial({ color });
    this.materialCache.set(normalizedColor, material);
    return material;
  }
}
