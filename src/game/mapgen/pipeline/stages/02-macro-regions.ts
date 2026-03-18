import type { MapgenPipelineStage, MapgenPipelineState } from '/game/mapgen/pipeline/contracts';
import { generatePoissonSeeds } from '/game/mapgen/pipeline/support/poisson';
import { assignVoronoiRegions, type VoronoiResult } from '/game/mapgen/pipeline/support/voronoi';

const ensureMinimumSeedCoverage = (
  seeds: { id: number; col: number; row: number }[],
  width: number,
  height: number,
  minimumSeedCount: number,
  random: { next: () => number },
) => {
  const nextSeeds = [...seeds];

  while (nextSeeds.length < minimumSeedCount) {
    nextSeeds.push({
      id: nextSeeds.length,
      col: random.next() * width,
      row: random.next() * height,
    });
  }

  return nextSeeds;
};

const createEmptyVoronoiResult = (): VoronoiResult => ({
  regionByTileIndex: new Int32Array(),
  regions: [],
});

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<
    Pick<MapgenPipelineState, 'grid' | 'subseeds' | 'primaryRegionTarget' | 'clampedLandRatio'>
  > => {
  if (!state.grid || !state.subseeds) {
    throw new Error('Macro region stage requires bootstrap stage output.');
  }

  if (typeof state.primaryRegionTarget !== 'number' || typeof state.clampedLandRatio !== 'number') {
    throw new Error('Macro region stage requires resolved target land settings.');
  }

  return state as MapgenPipelineState &
    Required<
      Pick<MapgenPipelineState, 'grid' | 'subseeds' | 'primaryRegionTarget' | 'clampedLandRatio'>
    >;
};

export const macroRegionsStage: MapgenPipelineStage = {
  id: '02-macro-regions',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    if (!nextState.grid.tiles.length) {
      return {
        ...nextState,
        seeds: [],
        voronoi: createEmptyVoronoiResult(),
      };
    }

    const minDistance = Math.max(2, nextState.profile.poissonMinDistance);
    const macroRandom = nextState.subseeds.random('macro');
    const initialSeeds = generatePoissonSeeds({
      width: nextState.context.width,
      height: nextState.context.height,
      minDistance,
      maxAttempts: nextState.profile.poissonAttempts,
      maxPoints: nextState.profile.poissonMaxSeeds,
      random: macroRandom,
    });
    const minimumSeedCount = Math.max(
      3,
      Math.min(nextState.grid.tiles.length, nextState.primaryRegionTarget + 2),
    );
    const seeds = ensureMinimumSeedCoverage(
      initialSeeds,
      nextState.context.width,
      nextState.context.height,
      minimumSeedCount,
      macroRandom,
    );

    return {
      ...nextState,
      seeds,
      voronoi: assignVoronoiRegions(nextState.grid, seeds),
    };
  },
};
