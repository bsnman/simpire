import { describe, expect, it } from 'vitest';

import {
  EDGE_PAN_THRESHOLD_PX,
  getArrowKeyPanVector,
  getEdgePanVector,
} from '~/game/render/cameraControls';

describe('camera edge pan controls', () => {
  it('returns no pan vector when pointer is away from edges', () => {
    const vector = getEdgePanVector(200, 140, 600, 400);

    expect(vector).toEqual({ x: 0, y: 0 });
  });

  it('returns full left pan at the left edge and full right pan at the right edge', () => {
    const left = getEdgePanVector(0, 120, 500, 300);
    const right = getEdgePanVector(500, 120, 500, 300);

    expect(left).toEqual({ x: -1, y: 0 });
    expect(right).toEqual({ x: 1, y: 0 });
  });

  it('scales pan intensity linearly across the edge threshold', () => {
    const halfThreshold = EDGE_PAN_THRESHOLD_PX / 2;
    const vector = getEdgePanVector(halfThreshold, 120, 500, 300);

    expect(vector.x).toBeCloseTo(-0.5, 5);
    expect(vector.y).toBe(0);
  });

  it('normalizes diagonal vectors so combined speed remains capped', () => {
    const vector = getEdgePanVector(0, 0, 500, 300);
    const magnitude = Math.hypot(vector.x, vector.y);

    expect(magnitude).toBeCloseTo(1, 5);
    expect(vector.x).toBeLessThan(0);
    expect(vector.y).toBeLessThan(0);
  });

  it('derives keyboard pan direction from arrow key state', () => {
    expect(getArrowKeyPanVector({ left: false, right: true, up: false, down: false })).toEqual({
      x: 1,
      y: 0,
    });

    const diagonal = getArrowKeyPanVector({ left: false, right: true, up: true, down: false });

    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 5);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.y).toBeLessThan(0);

    expect(getArrowKeyPanVector({ left: true, right: true, up: false, down: false })).toEqual({
      x: 0,
      y: 0,
    });
  });
});
