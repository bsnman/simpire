import { describe, expect, it } from 'vitest';

import type { HexCoord, HexLayout } from '~/types/hex';
import { axialToPixel, pixelToAxial, roundAxial } from '~/game/render/hexMath';

const SAMPLE_COORDS: HexCoord[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: -1, r: 2 },
  { q: 4, r: -3 },
];

describe('hexMath coordinate conversions', () => {
  const layouts: HexLayout[] = ['pointy', 'flat'];

  for (const layout of layouts) {
    it(`round-trips axial and pixel coordinates for ${layout} layout`, () => {
      for (const coord of SAMPLE_COORDS) {
        const pixel = axialToPixel(coord, 24, layout);
        const fromPixel = pixelToAxial(pixel, 24, layout);

        expect(roundAxial(fromPixel)).toEqual(coord);
      }
    });
  }

  it('rounds fractional axial coordinates to the nearest hex', () => {
    expect(roundAxial({ q: 0.62, r: -0.18 })).toEqual({ q: 1, r: 0 });
    expect(roundAxial({ q: -1.41, r: 0.79 })).toEqual({ q: -2, r: 1 });
  });
});
