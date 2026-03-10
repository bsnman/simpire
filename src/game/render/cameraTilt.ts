export type ZoomTiltConfig = {
  minZoom: number;
  tiltStartZoom: number;
  maxZoom: number;
  maxTiltRadians: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export const getZoomTiltRadians = (zoom: number, config: ZoomTiltConfig): number => {
  if (
    !Number.isFinite(zoom) ||
    !Number.isFinite(config.minZoom) ||
    !Number.isFinite(config.tiltStartZoom) ||
    !Number.isFinite(config.maxZoom) ||
    !Number.isFinite(config.maxTiltRadians)
  ) {
    return 0;
  }

  const minZoom = Math.min(config.minZoom, config.maxZoom);
  const maxZoom = Math.max(config.minZoom, config.maxZoom);
  const startZoom = clamp(config.tiltStartZoom, minZoom, maxZoom);
  const maxTiltRadians = Math.max(0, config.maxTiltRadians);

  if (maxTiltRadians === 0 || maxZoom === startZoom) {
    return 0;
  }

  const clampedZoom = clamp(zoom, minZoom, maxZoom);

  if (clampedZoom <= startZoom) {
    return 0;
  }

  const normalizedProgress = (clampedZoom - startZoom) / (maxZoom - startZoom);
  return maxTiltRadians * smoothstep(normalizedProgress);
};
