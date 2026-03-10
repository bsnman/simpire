import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  type ColorRepresentation,
} from 'three';

import type { HexKey, HexLayout } from '~/types/hex';
import { hexCornerPoints } from '~/game/render/hexMath';
import { HEX_KEY_USER_DATA_FIELD } from '~/game/render/three/raycast';

const BORDER_COLOR: ColorRepresentation = '#1D1D1D';
const BORDER_Z_OFFSET = 0.05;

type GeometryCacheKey = `${HexLayout}:${number}`;

const buildGeometryCacheKey = (layout: HexLayout, size: number): GeometryCacheKey =>
  `${layout}:${size}`;

const createHexShapeGeometry = (size: number, layout: HexLayout): ShapeGeometry => {
  const points = hexCornerPoints(0, 0, size, layout);
  const shape = new Shape();

  shape.moveTo(points[0] ?? 0, points[1] ?? 0);

  for (let index = 2; index < points.length; index += 2) {
    shape.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
  }

  shape.closePath();

  return new ShapeGeometry(shape);
};

const createHexBorderGeometry = (size: number, layout: HexLayout): BufferGeometry => {
  const points = hexCornerPoints(0, 0, size, layout);
  const positions: number[] = [];

  for (let index = 0; index < points.length; index += 2) {
    positions.push(points[index] ?? 0, points[index + 1] ?? 0, 0);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
};

export class HexTileMeshFactory {
  private readonly geometryCache = new Map<GeometryCacheKey, ShapeGeometry>();
  private readonly borderGeometryCache = new Map<GeometryCacheKey, BufferGeometry>();
  private readonly fillMaterialCache = new Map<string, MeshBasicMaterial>();
  private readonly borderMaterial = new LineBasicMaterial({ color: BORDER_COLOR });

  createTileMesh(
    tileSize: number,
    layout: HexLayout,
    tileColor: ColorRepresentation,
    tileKey: HexKey,
  ): Mesh {
    const mesh = new Mesh(this.getHexGeometry(tileSize, layout), this.getFillMaterial(tileColor));

    mesh.userData[HEX_KEY_USER_DATA_FIELD] = tileKey;

    const border = new LineLoop(this.getHexBorderGeometry(tileSize, layout), this.borderMaterial);
    border.position.z = BORDER_Z_OFFSET;
    mesh.add(border);

    return mesh;
  }

  destroy() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();

    this.borderGeometryCache.forEach((geometry) => geometry.dispose());
    this.borderGeometryCache.clear();

    this.fillMaterialCache.forEach((material) => material.dispose());
    this.fillMaterialCache.clear();

    this.borderMaterial.dispose();
  }

  private getHexGeometry(tileSize: number, layout: HexLayout): ShapeGeometry {
    const cacheKey = buildGeometryCacheKey(layout, tileSize);
    const cached = this.geometryCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const geometry = createHexShapeGeometry(tileSize, layout);
    this.geometryCache.set(cacheKey, geometry);
    return geometry;
  }

  private getHexBorderGeometry(tileSize: number, layout: HexLayout): BufferGeometry {
    const cacheKey = buildGeometryCacheKey(layout, tileSize);
    const cached = this.borderGeometryCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const geometry = createHexBorderGeometry(tileSize, layout);
    this.borderGeometryCache.set(cacheKey, geometry);
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
