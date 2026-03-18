import { clamp } from '/game/mapgen/helpers';
import type { MapgenPipelineStage, MapgenPipelineState } from '/game/mapgen/pipeline/contracts';
import { buildDeterministicShuffle, type MapGrid } from '/game/mapgen/pipeline/support/grid';
import type { SeededRandom } from '/game/mapgen/random';
import type { MapTile } from '/types/map';

export type ElevationSprayConfig = {
  density: number;
  random: SeededRandom;
};

const SHOTS_PER_TILE_AT_MAX_DENSITY = 0.3;
const FLAT_TO_MOUNTAIN_CHANCE = 0.15;

export const applyElevationSpray = (
  grid: MapGrid,
  tiles: readonly MapTile[],
  config: ElevationSprayConfig,
): MapTile[] => {
  if (tiles.length !== grid.tiles.length) {
    throw new Error('Elevation spray requires tile count to match grid tile count.');
  }

  const density = clamp(config.density, 0, 1);
  const shotCount = Math.min(
    grid.tiles.length,
    Math.round(grid.tiles.length * density * SHOTS_PER_TILE_AT_MAX_DENSITY),
  );

  if (shotCount <= 0) {
    return [...tiles];
  }

  const nextTiles = [...tiles];
  const shuffledIndices = buildDeterministicShuffle(grid.tiles.length, config.random);

  for (let shotIndex = 0; shotIndex < shotCount; shotIndex += 1) {
    const tileIndex = shuffledIndices[shotIndex];

    if (typeof tileIndex !== 'number') {
      continue;
    }

    const tile = nextTiles[tileIndex];

    if (!tile || tile.elevation === 'underwater' || tile.elevation === 'mountain') {
      continue;
    }

    if (tile.elevation === 'hill') {
      nextTiles[tileIndex] = {
        ...tile,
        elevation: 'mountain',
      };
      continue;
    }

    nextTiles[tileIndex] = {
      ...tile,
      elevation: config.random.next() < FLAT_TO_MOUNTAIN_CHANCE ? 'mountain' : 'hill',
    };
  }

  return nextTiles;
};

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<Pick<MapgenPipelineState, 'grid' | 'terrainClassification' | 'subseeds'>> => {
  if (!state.grid || !state.terrainClassification || !state.subseeds) {
    throw new Error('Elevation spray stage requires terrain classification output.');
  }

  return state as MapgenPipelineState &
    Required<Pick<MapgenPipelineState, 'grid' | 'terrainClassification' | 'subseeds'>>;
};

export const elevationSprayStage: MapgenPipelineStage = {
  id: '07-elevation-spray',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      sprayedTiles: applyElevationSpray(nextState.grid, nextState.terrainClassification.tiles, {
        density: nextState.profile.elevationSprayDensity,
        random: nextState.subseeds.random('elevation-spray'),
      }),
    };
  },
};
