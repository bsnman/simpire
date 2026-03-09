import { generateMap } from '~/game/mapgen';
import type { MapGenerationRequest } from '~/game/mapgen/contracts';
import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import {
  aggregateMapQualityMetrics,
  buildLandMaskFromTiles,
  calculateMapQualityMetrics,
  type AggregatedMapQualityMetrics,
  type MapQualityMetrics,
} from '~/game/mapgen/pipeline/metrics';
import type { MapTile } from '~/types/map';

export type MapgenDiagnosticsScenario = {
  algorithmId: string;
  width: number;
  height: number;
  params: unknown;
  sampleCount: number;
  seedPrefix?: string;
  layout?: MapGenerationRequest['layout'];
  tileSize?: number;
  origin?: MapGenerationRequest['origin'];
};

export type MapgenDiagnosticsReport = {
  scenario: MapgenDiagnosticsScenario;
  samples: MapQualityMetrics[];
  aggregate: AggregatedMapQualityMetrics;
};

const DEFAULT_LAYOUT: MapGenerationRequest['layout'] = 'pointy';
const DEFAULT_TILE_SIZE = 24;
const DEFAULT_ORIGIN = { x: 80, y: 80 };

const tileArrayFromMap = (map: ReturnType<typeof generateMap>): MapTile[] => {
  return map.tileKeys
    .map((key) => map.tilesByKey[key])
    .filter((tile): tile is MapTile => Boolean(tile));
};

export const runMapgenDiagnostics = (
  scenario: MapgenDiagnosticsScenario,
): MapgenDiagnosticsReport => {
  const sampleCount = Math.max(1, Math.floor(scenario.sampleCount));
  const seedPrefix = scenario.seedPrefix ?? `${scenario.algorithmId}-diagnostic`;
  const grid = createMapGrid(scenario.width, scenario.height, () =>
    createRectCoords(scenario.width, scenario.height),
  );

  const samples: MapQualityMetrics[] = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const request: MapGenerationRequest = {
      algorithmId: scenario.algorithmId,
      width: scenario.width,
      height: scenario.height,
      seedHash: `${seedPrefix}-${sampleIndex}`,
      params: scenario.params,
      layout: scenario.layout ?? DEFAULT_LAYOUT,
      tileSize: scenario.tileSize ?? DEFAULT_TILE_SIZE,
      origin: scenario.origin ?? DEFAULT_ORIGIN,
      mapId: `${seedPrefix}-${sampleIndex}`,
    };

    const map = generateMap(request);
    const landMask = buildLandMaskFromTiles(grid, tileArrayFromMap(map));
    samples.push(calculateMapQualityMetrics(grid, landMask));
  }

  return {
    scenario,
    samples,
    aggregate: aggregateMapQualityMetrics(samples),
  };
};
