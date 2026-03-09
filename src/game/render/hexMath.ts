import type { HexCoord, HexLayout } from '~/types/hex';

const SQRT3 = Math.sqrt(3);
const CORNER_COUNT = 6;
const TWO_PI = Math.PI * 2;
const normalizeSignedZero = (value: number) => (Object.is(value, -0) ? 0 : value);

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

export const pixelToAxial = (
  point: { x: number; y: number },
  size: number,
  layout: HexLayout,
): HexCoord => {
  if (layout === 'flat') {
    const q = ((2 / 3) * point.x) / size;
    const r = point.y / (SQRT3 * size) - q / 2;

    return { q, r };
  }

  const r = ((2 / 3) * point.y) / size;
  const q = point.x / (SQRT3 * size) - r / 2;

  return { q, r };
};

export const roundAxial = (coord: HexCoord): HexCoord => {
  const x = coord.q;
  const z = coord.r;
  const y = -x - z;

  let roundedX = Math.round(x);
  let roundedY = Math.round(y);
  let roundedZ = Math.round(z);

  const xDifference = Math.abs(roundedX - x);
  const yDifference = Math.abs(roundedY - y);
  const zDifference = Math.abs(roundedZ - z);

  if (xDifference > yDifference && xDifference > zDifference) {
    roundedX = -roundedY - roundedZ;
  } else if (yDifference > zDifference) {
    roundedY = -roundedX - roundedZ;
  } else {
    roundedZ = -roundedX - roundedY;
  }

  return {
    q: normalizeSignedZero(roundedX),
    r: normalizeSignedZero(roundedZ),
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
