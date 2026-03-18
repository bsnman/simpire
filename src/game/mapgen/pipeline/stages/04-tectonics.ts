import { clamp } from '/game/mapgen/helpers';
import type {
  MapgenPipelineStage,
  MapgenPipelineState,
  PlateVector,
  TectonicState,
} from '/game/mapgen/pipeline/contracts';
import { normalizeField } from '/game/mapgen/pipeline/support/fields';
import { isLandAt, type MapGrid } from '/game/mapgen/pipeline/support/grid';
import type { VoronoiResult } from '/game/mapgen/pipeline/support/voronoi';
import type { SeededRandom } from '/game/mapgen/random';

export type TectonicPassConfig = {
  strength: number;
  random: SeededRandom;
  noiseAt: (q: number, r: number, salt?: string) => number;
};

const assignPlateVectors = (regionCount: number, random: SeededRandom): PlateVector[] => {
  const vectors: PlateVector[] = [];

  for (let regionIndex = 0; regionIndex < regionCount; regionIndex += 1) {
    const angle = random.next() * Math.PI * 2;
    const speed = 0.45 + random.next() * 0.85;

    vectors.push({
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });
  }

  return vectors;
};

export const applyTectonicPass = (
  grid: MapGrid,
  voronoi: VoronoiResult,
  landMask: ArrayLike<number>,
  config: TectonicPassConfig,
): TectonicState => {
  if (!grid.tiles.length) {
    return {
      elevation: new Float64Array(),
      boundaryIntensity: new Float64Array(),
      plateVectors: [],
    };
  }

  const strength = clamp(config.strength, 0, 1);
  const plateVectors = assignPlateVectors(voronoi.regions.length, config.random);
  const rawElevation = new Float64Array(grid.tiles.length);
  const rawBoundaryIntensity = new Float64Array(grid.tiles.length);

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    const tile = grid.tiles[tileIndex];

    if (!tile) {
      continue;
    }

    const regionId = voronoi.regionByTileIndex[tileIndex] ?? 0;
    const localVector = plateVectors[regionId] ?? { x: 0, y: 0 };
    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

    let uplift = 0;
    let subsidence = 0;
    let boundaryContacts = 0;

    for (const neighborIndex of neighbors) {
      if (neighborIndex < 0) {
        continue;
      }

      const neighborRegionId = voronoi.regionByTileIndex[neighborIndex] ?? regionId;

      if (neighborRegionId === regionId) {
        continue;
      }

      const neighborTile = grid.tiles[neighborIndex];
      const neighborVector = plateVectors[neighborRegionId] ?? { x: 0, y: 0 };

      if (!neighborTile) {
        continue;
      }

      const deltaX = neighborTile.col - tile.col;
      const deltaY = neighborTile.row - tile.row;
      const length = Math.hypot(deltaX, deltaY);

      if (length <= 0) {
        continue;
      }

      const normalX = deltaX / length;
      const normalY = deltaY / length;
      const relativeVelocityX = localVector.x - neighborVector.x;
      const relativeVelocityY = localVector.y - neighborVector.y;
      const convergence = relativeVelocityX * normalX + relativeVelocityY * normalY;

      boundaryContacts += 1;

      if (convergence >= 0) {
        uplift += convergence;
      } else {
        subsidence += -convergence;
      }
    }

    const boundaryFactor = boundaryContacts / 5;
    const tectonicLift = uplift * 0.12 * strength;
    const tectonicDrop = subsidence * 0.0 * strength;
    const baseElevation = isLandAt(landMask, tileIndex) ? 0.48 : 0.24;
    const baseNoise = (config.noiseAt(tile.q, tile.r, 'tectonic-base') - 0.5) * 0.07;
    const jitter = (config.noiseAt(tile.q, tile.r, 'tectonic-jitter') - 0.5) * 0.09;

    rawBoundaryIntensity[tileIndex] = boundaryFactor;
    rawElevation[tileIndex] =
      baseElevation + tectonicLift - tectonicDrop + boundaryFactor * 0.06 + baseNoise + jitter;
  }

  const normalizedElevation = normalizeField(rawElevation);
  const normalizedBoundary = normalizeField(rawBoundaryIntensity);
  const finalElevation = new Float64Array(grid.tiles.length);

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    const normalized = normalizedElevation[tileIndex] ?? 0;
    const boundaryBoost = normalizedBoundary[tileIndex] ?? 0;

    if (isLandAt(landMask, tileIndex)) {
      finalElevation[tileIndex] = clamp(
        0.08 + normalized * 0.7 + boundaryBoost * 0.14 * strength,
        0,
        1,
      );
      continue;
    }

    finalElevation[tileIndex] = clamp(normalized * 0.45 - 0.04, 0, 1);
  }

  return {
    elevation: finalElevation,
    boundaryIntensity: normalizedBoundary,
    plateVectors,
  };
};

const requireState = (
  state: MapgenPipelineState,
): MapgenPipelineState &
  Required<Pick<MapgenPipelineState, 'grid' | 'voronoi' | 'macroLandMask' | 'subseeds'>> => {
  if (!state.grid || !state.voronoi || !state.macroLandMask || !state.subseeds) {
    throw new Error('Tectonics stage requires land mask and macro region outputs.');
  }

  return state as MapgenPipelineState &
    Required<Pick<MapgenPipelineState, 'grid' | 'voronoi' | 'macroLandMask' | 'subseeds'>>;
};

export const tectonicsStage: MapgenPipelineStage = {
  id: '04-tectonics',
  run: (state: MapgenPipelineState): MapgenPipelineState => {
    const nextState = requireState(state);

    return {
      ...nextState,
      tectonics: applyTectonicPass(
        nextState.grid,
        nextState.voronoi,
        nextState.macroLandMask.landMask,
        {
          strength: nextState.profile.tectonicStrength,
          random: nextState.subseeds.random('elevation'),
          noiseAt: (q, r, salt) => nextState.subseeds.noiseAt('elevation', q, r, salt),
        },
      ),
    };
  },
};
