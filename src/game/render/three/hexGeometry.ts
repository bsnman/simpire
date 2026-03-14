import { Path, Shape, ShapeGeometry } from 'three';

import type { HexLayout } from '~/types/hex';
import { hexCornerPoints } from '~/game/render/hexMath';

export type HexGeometryCacheKey = `${HexLayout}:${number}`;

export const buildHexGeometryCacheKey = (layout: HexLayout, size: number): HexGeometryCacheKey =>
  `${layout}:${size}`;

const tracePolygonPath = (path: Shape | Path, points: ReadonlyArray<number>) => {
  path.moveTo(points[0] ?? 0, points[1] ?? 0);

  for (let index = 2; index < points.length; index += 2) {
    path.lineTo(points[index] ?? 0, points[index + 1] ?? 0);
  }

  path.closePath();
};

const reversePointPairs = (points: ReadonlyArray<number>): number[] => {
  const reversed: number[] = [];

  for (let index = points.length - 2; index >= 0; index -= 2) {
    reversed.push(points[index] ?? 0, points[index + 1] ?? 0);
  }

  return reversed;
};

export const createHexShapeGeometry = (size: number, layout: HexLayout): ShapeGeometry => {
  const points = hexCornerPoints(0, 0, size, layout);
  const shape = new Shape();

  tracePolygonPath(shape, points);

  return new ShapeGeometry(shape);
};

export const createHexRingGeometry = (
  size: number,
  layout: HexLayout,
  thickness: number,
): ShapeGeometry => {
  const halfThickness = thickness / 2;
  const outerPoints = hexCornerPoints(0, 0, size + halfThickness, layout);
  const innerSize = Math.max(size - halfThickness, 0.001);
  const innerPoints = reversePointPairs(hexCornerPoints(0, 0, innerSize, layout));
  const shape = new Shape();
  const hole = new Path();

  tracePolygonPath(shape, outerPoints);
  tracePolygonPath(hole, innerPoints);
  shape.holes.push(hole);

  return new ShapeGeometry(shape);
};
