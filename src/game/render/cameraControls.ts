export const EDGE_PAN_THRESHOLD_PX = 42;
export const EDGE_PAN_SPEED_PX_PER_SECOND = 900;
export const POINTER_LOCK_PAN_SENSITIVITY = 1.15;

export type EdgePanVector = {
  x: number;
  y: number;
};

export type ArrowKeyPanState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const axisEdgeIntensity = (value: number, axisSize: number, threshold: number): number => {
  if (axisSize <= 0 || threshold <= 0) {
    return 0;
  }

  const edgeSize = Math.min(threshold, axisSize / 2);

  if (edgeSize <= 0) {
    return 0;
  }

  if (value < 0 || value > axisSize) {
    return 0;
  }

  if (value <= edgeSize) {
    return -(1 - value / edgeSize);
  }

  const distanceToMax = axisSize - value;

  if (distanceToMax <= edgeSize) {
    return 1 - distanceToMax / edgeSize;
  }

  return 0;
};

export const normalizePanVector = (x: number, y: number): EdgePanVector => {
  const magnitude = Math.hypot(x, y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  if (magnitude <= 1) {
    return {
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1),
    };
  }

  return {
    x: x / magnitude,
    y: y / magnitude,
  };
};

export const getArrowKeyPanVector = (state: ArrowKeyPanState): EdgePanVector => {
  const horizontal = (state.right ? 1 : 0) - (state.left ? 1 : 0);
  const vertical = (state.down ? 1 : 0) - (state.up ? 1 : 0);
  return normalizePanVector(horizontal, vertical);
};

export const getEdgePanVector = (
  pointerX: number,
  pointerY: number,
  viewportWidth: number,
  viewportHeight: number,
  threshold: number = EDGE_PAN_THRESHOLD_PX,
): EdgePanVector => {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0 };
  }

  const rawX = axisEdgeIntensity(pointerX, viewportWidth, threshold);
  const rawY = axisEdgeIntensity(pointerY, viewportHeight, threshold);
  return normalizePanVector(rawX, rawY);
};
