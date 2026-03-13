import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  ShapeGeometry,
  type ColorRepresentation,
} from 'three';

import type { HexKey, HexLayout } from '~/types/hex';
import {
  buildHexGeometryCacheKey,
  createHexShapeGeometry,
  type HexGeometryCacheKey,
} from '~/game/render/three/hexGeometry';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';

export class HexTileMeshFactory {
  private readonly geometryCache = new Map<HexGeometryCacheKey, ShapeGeometry>();
  private readonly fillMaterialCache = new Map<string, MeshBasicMaterial>();

  createTileFillMesh(
    tileSize: number,
    layout: HexLayout,
    tileColor: ColorRepresentation,
    tileKey: HexKey,
  ): Mesh {
    const mesh = new Mesh(this.getHexGeometry(tileSize, layout), this.getFillMaterial(tileColor));

    mesh.name = `hex-tile-fill:${tileKey}`;
    mesh.userData[HEX_KEY_USER_DATA_FIELD] = tileKey;
    return mesh;
  }

  destroy() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();

    this.fillMaterialCache.forEach((material) => material.dispose());
    this.fillMaterialCache.clear();
  }

  private getHexGeometry(tileSize: number, layout: HexLayout): ShapeGeometry {
    const cacheKey = buildHexGeometryCacheKey(layout, tileSize);
    const cached = this.geometryCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const geometry = createHexShapeGeometry(tileSize, layout);
    this.geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  private getFillMaterial(color: ColorRepresentation): MeshBasicMaterial {
    const normalizedColor = new Color(color).getHexString();
    const cached = this.fillMaterialCache.get(normalizedColor);

    if (cached) {
      return cached;
    }

    const material = new MeshBasicMaterial({
      color,
      side: DoubleSide,
    });

    this.fillMaterialCache.set(normalizedColor, material);
    return material;
  }
}
