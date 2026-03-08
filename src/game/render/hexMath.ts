import type { HexCoord, HexLayout } from '../../types/hex';

const SQRT3 = Math.sqrt(3);
const CORNER_COUNT = 6;
const TWO_PI = Math.PI * 2;

export const axialToPixel = (
  coord: HexCoord,
  size: number,
  layout: HexLayout,
): { x: number; y: number } => {
  if (layout === 'flat') {
    return {
      x: size * ((3 / 2) * coord.q),
      y: size * (SQRT3 * (coord.r + coord.q / 2)),
    };
  }

  return {
    x: size * (SQRT3 * (coord.q + coord.r / 2)),
    y: size * ((3 / 2) * coord.r),
  };
};

export const hexCornerPoints = (
  centerX: number,
  centerY: number,
  size: number,
  layout: HexLayout,
): number[] => {
  const angleOffset = layout === 'pointy' ? Math.PI / 6 : 0;
  const points: number[] = [];

  for (let i = 0; i < CORNER_COUNT; i += 1) {
    const angle = (TWO_PI / CORNER_COUNT) * i + angleOffset;
    points.push(centerX + size * Math.cos(angle), centerY + size * Math.sin(angle));
  }

  return points;
};
