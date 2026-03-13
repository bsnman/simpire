import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three';

import type { HexLayout } from '~/types/hex';
import { hexCornerPoints } from '~/game/render/hexMath';

export type HexGeometryCacheKey = `${HexLayout}:${number}`;

export const buildHexGeometryCacheKey = (
  layout: HexLayout,
  size: number,
): HexGeometryCacheKey => `${layout}:${size}`;

export const createHexShapeGeometry = (size: number, layout: HexLayout): ShapeGeometry => {
  const points = hexCornerPoints(0, 0, size, layout);
  const shape = new Shape();

  shape.moveTo(points[0] ?? 0, points[1] ?? 0);

  for (let index = 2; index < points.length; index += 2) {
    shape.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
  }

  shape.closePath();

  return new ShapeGeometry(shape);
};

export const createHexBorderGeometry = (size: number, layout: HexLayout): BufferGeometry => {
  const points = hexCornerPoints(0, 0, size, layout);
  const positions: number[] = [];

  for (let index = 0; index < points.length; index += 2) {
    positions.push(points[index] ?? 0, points[index + 1] ?? 0, 0);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
};
