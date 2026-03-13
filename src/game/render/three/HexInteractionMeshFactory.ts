import { DoubleSide, Mesh, MeshBasicMaterial, ShapeGeometry } from 'three';

import type { HexKey, HexLayout } from '~/types/hex';
import { buildMapInteractionObjectName } from '~/game/render/layers/mapLayerObjectNames';
import {
  buildHexGeometryCacheKey,
  createHexShapeGeometry,
  type HexGeometryCacheKey,
} from '~/game/render/three/hexGeometry';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';

export class HexInteractionMeshFactory {
  private readonly geometryCache = new Map<HexGeometryCacheKey, ShapeGeometry>();
  private readonly interactionMaterial = new MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    side: DoubleSide,
    transparent: true,
  });

  constructor() {
    this.interactionMaterial.colorWrite = false;
  }

  createInteractionMesh(tileSize: number, layout: HexLayout, tileKey: HexKey): Mesh {
    const mesh = new Mesh(this.getHexGeometry(tileSize, layout), this.interactionMaterial);

    mesh.name = buildMapInteractionObjectName(tileKey);
    mesh.userData[HEX_KEY_USER_DATA_FIELD] = tileKey;
    return mesh;
  }

  destroy() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();
    this.interactionMaterial.dispose();
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
}
