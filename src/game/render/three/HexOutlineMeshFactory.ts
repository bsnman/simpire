import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  type ColorRepresentation,
} from 'three';

import type { HexKey, HexLayout } from '~/types/hex';
import { buildMapHexOutlineObjectName } from '~/game/render/layers/mapLayerObjectNames';
import {
  buildHexGeometryCacheKey,
  createHexRingGeometry,
  type HexGeometryCacheKey,
} from '~/game/render/three/hexGeometry';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';

const HEX_OUTLINE_RENDER_ORDER = 1000;
type HexOutlineGeometryCacheKey = `${HexGeometryCacheKey}:${number}`;

export class HexOutlineMeshFactory {
  private readonly geometryCache = new Map<HexOutlineGeometryCacheKey, ShapeGeometry>();
  private readonly materialCache = new Map<string, MeshBasicMaterial>();

  createHexOutline(
    tileSize: number,
    layout: HexLayout,
    color: ColorRepresentation,
    thickness: number,
    tileKey: HexKey,
  ): Mesh {
    const outline = new Mesh(
      this.getHexOutlineGeometry(tileSize, layout, thickness),
      this.getOutlineMaterial(color),
    );

    outline.name = buildMapHexOutlineObjectName(tileKey);
    outline.userData[HEX_KEY_USER_DATA_FIELD] = tileKey;
    outline.renderOrder = HEX_OUTLINE_RENDER_ORDER;
    return outline;
  }

  destroy() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();

    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
  }

  private getHexOutlineGeometry(
    tileSize: number,
    layout: HexLayout,
    thickness: number,
  ): ShapeGeometry {
    const cacheKey = `${buildHexGeometryCacheKey(layout, tileSize)}:${thickness}` as const;
    const cached = this.geometryCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const geometry = createHexRingGeometry(tileSize, layout, thickness);
    this.geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  private getOutlineMaterial(color: ColorRepresentation): MeshBasicMaterial {
    const normalizedColor = new Color(color).getHexString();
    const cached = this.materialCache.get(normalizedColor);

    if (cached) {
      return cached;
    }

    const material = new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.materialCache.set(normalizedColor, material);
    return material;
  }
}
