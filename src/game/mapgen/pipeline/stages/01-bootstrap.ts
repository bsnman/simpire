import { clamp } from '/game/mapgen/helpers';
import type {
  MapgenPipelineStage,
  MapgenPipelineState,
  MapgenPipelineProfile,
} from '/game/mapgen/pipeline/contracts';
import { createMapGrid } from '/game/mapgen/pipeline/support/grid';
import { createSubseedStreams } from '/game/mapgen/pipeline/support/subseeds';

const resolvePrimaryRegionTarget = (
  profile: Pick<
    MapgenPipelineProfile,
    'primaryRegionTarget' | 'primaryRegionTargetMin' | 'primaryRegionTargetMax'
  >,
  random: { int: (min: number, max: number) => number },
): number => {
  const fallback = Math.max(1, Math.round(profile.primaryRegionTarget));
  const min = Math.max(1, Math.round(profile.primaryRegionTargetMin ?? fallback));
  const max = Math.max(min, Math.round(profile.primaryRegionTargetMax ?? min));

  if (min === max) {
    return min;
  }

  return random.int(min, max + 1);
};

export const bootstrapStage: MapgenPipelineStage = {
  id: '01-bootstrap',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const grid = createMapGrid(
      state.context.width,
      state.context.height,
      state.context.createRectCoords,
    );
    const subseeds = createSubseedStreams(state.context);
    const macroRandom = subseeds.random('macro');

    return {
      ...state,
      grid,
      subseeds,
      clampedLandRatio: clamp(state.profile.landRatio, 0, 1),
      primaryRegionTarget: resolvePrimaryRegionTarget(state.profile, macroRandom),
    };
  },
};
