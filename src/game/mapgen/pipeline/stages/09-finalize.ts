import {
  calculateMapQualityMetrics,
  createEmptyMapQualityMetrics,
} from '/game/mapgen/analysis/metrics';
import type { MapgenPipelineStage, MapgenPipelineState } from '/game/mapgen/pipeline/contracts';

export const finalizeStage: MapgenPipelineStage = {
  id: '09-finalize',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    if (!state.grid?.tiles.length) {
      return {
        ...state,
        tiles: [],
        metrics: createEmptyMapQualityMetrics(),
        debug: {
          seedCount: 0,
          regionCount: 0,
          targetLandRatio: 0,
          actualLandRatio: 0,
        },
      };
    }

    if (!state.detailPass || !state.tiles || typeof state.clampedLandRatio !== 'number') {
      throw new Error('Finalize stage requires completed land mask and tile outputs.');
    }

    const metrics = calculateMapQualityMetrics(state.grid, state.detailPass.landMask);

    return {
      ...state,
      metrics,
      debug: {
        seedCount: state.seeds?.length ?? 0,
        regionCount: state.voronoi?.regions.length ?? 0,
        targetLandRatio: state.clampedLandRatio,
        actualLandRatio: metrics.landRatio,
      },
    };
  },
};
