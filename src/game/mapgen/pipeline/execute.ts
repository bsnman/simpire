import type {
  MapgenPipelineProfile,
  MapgenPipelineResult,
  MapgenPipelineStage,
  MapgenPipelineState,
} from '/game/mapgen/pipeline/contracts';
import { bootstrapStage } from '/game/mapgen/pipeline/stages/01-bootstrap';
import { macroRegionsStage } from '/game/mapgen/pipeline/stages/02-macro-regions';
import { landMaskStage } from '/game/mapgen/pipeline/stages/03-land-mask';
import { tectonicsStage } from '/game/mapgen/pipeline/stages/04-tectonics';
import { detailNoiseStage } from '/game/mapgen/pipeline/stages/05-detail-noise';
import { terrainClassificationStage } from '/game/mapgen/pipeline/stages/06-terrain-classification';
import { elevationSprayStage } from '/game/mapgen/pipeline/stages/07-elevation-spray';
import { terrainFeaturesStage } from '/game/mapgen/pipeline/stages/08-terrain-features';
import { finalizeStage } from '/game/mapgen/pipeline/stages/09-finalize';
import type { MapGeneratorContext } from '/game/mapgen/contracts';

export const MAPGEN_PIPELINE_STAGES: readonly MapgenPipelineStage[] = [
  bootstrapStage,
  macroRegionsStage,
  landMaskStage,
  tectonicsStage,
  detailNoiseStage,
  terrainClassificationStage,
  elevationSprayStage,
  terrainFeaturesStage,
  finalizeStage,
];

export const runMapgenPipeline = (
  context: MapGeneratorContext,
  profile: MapgenPipelineProfile,
): MapgenPipelineResult => {
  let state: MapgenPipelineState = {
    context,
    profile,
  };

  for (const stage of MAPGEN_PIPELINE_STAGES) {
    state = stage.run(state);
  }

  if (!state.tiles || !state.metrics || !state.debug) {
    throw new Error('Mapgen pipeline did not produce a complete result.');
  }

  return {
    tiles: state.tiles,
    metrics: state.metrics,
    debug: state.debug,
  };
};
