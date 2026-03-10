import { describe, expect, it } from 'vitest';

import { getZoomTiltRadians, type ZoomTiltConfig } from '~/game/render/cameraTilt';

const DEFAULT_CONFIG: ZoomTiltConfig = {
  minZoom: 0.3,
  tiltStartZoom: 0.62,
  maxZoom: 2.5,
  maxTiltRadians: (42 * Math.PI) / 180,
};

describe('camera tilt helpers', () => {
  it('keeps top-down view at or below tilt start zoom', () => {
    expect(getZoomTiltRadians(0.3, DEFAULT_CONFIG)).toBe(0);
    expect(getZoomTiltRadians(DEFAULT_CONFIG.tiltStartZoom, DEFAULT_CONFIG)).toBe(0);
    expect(getZoomTiltRadians(0.5, DEFAULT_CONFIG)).toBe(0);
  });

  it('caps tilt at maximum when zoom reaches or exceeds max zoom', () => {
    expect(getZoomTiltRadians(DEFAULT_CONFIG.maxZoom, DEFAULT_CONFIG)).toBeCloseTo(
      DEFAULT_CONFIG.maxTiltRadians,
    );
    expect(getZoomTiltRadians(9, DEFAULT_CONFIG)).toBeCloseTo(DEFAULT_CONFIG.maxTiltRadians);
  });

  it('eases tilt smoothly between start and max zoom', () => {
    const midpoint =
      DEFAULT_CONFIG.tiltStartZoom + (DEFAULT_CONFIG.maxZoom - DEFAULT_CONFIG.tiltStartZoom) / 2;
    const tiltAtMidpoint = getZoomTiltRadians(midpoint, DEFAULT_CONFIG);

    expect(tiltAtMidpoint).toBeCloseTo(DEFAULT_CONFIG.maxTiltRadians * 0.5);
  });

  it('returns zero for degenerate tilt ranges', () => {
    expect(
      getZoomTiltRadians(2, {
        minZoom: 2,
        tiltStartZoom: 2,
        maxZoom: 2,
        maxTiltRadians: 1,
      }),
    ).toBe(0);
  });
});
