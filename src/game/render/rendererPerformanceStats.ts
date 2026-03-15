export type RendererPerformanceStats = {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  lines: number;
  points: number;
};

export const DEFAULT_RENDERER_PERFORMANCE_STATS: RendererPerformanceStats = {
  fps: 0,
  frameTimeMs: 0,
  drawCalls: 0,
  triangles: 0,
  lines: 0,
  points: 0,
};
