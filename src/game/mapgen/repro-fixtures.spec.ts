import { generateMap } from '~/game/mapgen';
import {
  calculateMapQualityMetricsForMap,
  createMapDigest,
  parseMapgenReplayInput,
  stringifyMapgenReproPayload,
} from '~/game/mapgen/repro';
import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import {
  buildLandMaskFromTiles,
  calculateLandCorridorMetrics,
} from '~/game/mapgen/pipeline/metrics';
import { archipelagoDiagonalReproFixture } from '~/game/mapgen/fixtures/archipelagoDiagonalRepro';
import type { MapTile } from '~/types/map';

describe('mapgen repro fixtures', () => {
  it('replays archipelago diagonal repro payload with reduced linear land streak artifacts', () => {
    const firstMap = generateMap(archipelagoDiagonalReproFixture.request);
    const secondMap = generateMap(archipelagoDiagonalReproFixture.request);
    const firstDigest = createMapDigest(firstMap);
    const secondDigest = createMapDigest(secondMap);
    const metrics = calculateMapQualityMetricsForMap(
      archipelagoDiagonalReproFixture.request,
      firstMap,
    );
    const grid = createMapGrid(
      archipelagoDiagonalReproFixture.request.width,
      archipelagoDiagonalReproFixture.request.height,
      () =>
        createRectCoords(
          archipelagoDiagonalReproFixture.request.width,
          archipelagoDiagonalReproFixture.request.height,
        ),
    );
    const tiles: MapTile[] = firstMap.tileKeys
      .map((key) => firstMap.tilesByKey[key])
      .filter((tile): tile is MapTile => Boolean(tile));
    const landMask = buildLandMaskFromTiles(grid, tiles);
    const corridorMetrics = calculateLandCorridorMetrics(grid, landMask);
    const requestParams = archipelagoDiagonalReproFixture.request.params as {
      landRatio?: number;
    };
    const targetLandRatio = requestParams.landRatio ?? 0.24;

    expect(firstDigest).toBe(secondDigest);
    expect(firstDigest).not.toBe(archipelagoDiagonalReproFixture.mapDigest);
    expect(Math.abs(metrics.landRatio - targetLandRatio)).toBeLessThanOrEqual(0.01);
    expect(corridorMetrics.tileCount).toBeLessThanOrEqual(5);
    expect(corridorMetrics.tileRatio).toBeLessThan(0.01);
  });

  it('parses fixture payload in replay helper format', () => {
    const serialized = stringifyMapgenReproPayload(archipelagoDiagonalReproFixture);
    const parsed = parseMapgenReplayInput(serialized);

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.request).toEqual(archipelagoDiagonalReproFixture.request);
      expect(parsed.value.expectedMapDigest).toBe(archipelagoDiagonalReproFixture.mapDigest);
    }
  });
});
