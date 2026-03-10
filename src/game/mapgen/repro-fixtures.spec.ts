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

const archipelagoHillBalanceRepro = {
  request: {
    algorithmId: 'archipelago',
    width: 70,
    height: 70,
    layout: 'pointy',
    tileSize: 24,
    origin: {
      x: 80,
      y: 80,
    },
    seedHash: 'archipelago-1773116097681',
    mapId: 'game-1773116097681',
    params: {
      landRatio: 0.24,
      islandSizeBias: 0.36,
      chainTendency: 0.64,
      shelfWidth: 2,
      tectonicStrength: 0.52,
    },
  },
} as const;

const countLandTerrains = (tiles: readonly MapTile[]) => {
  let grassland = 0;
  let plains = 0;
  let desert = 0;
  let tundra = 0;
  let flat = 0;
  let hill = 0;
  let mountain = 0;

  for (const tile of tiles) {
    if (tile.terrain === 'grassland') {
      grassland += 1;
    } else if (tile.terrain === 'plains') {
      plains += 1;
    } else if (tile.terrain === 'desert') {
      desert += 1;
    } else if (tile.terrain === 'tundra') {
      tundra += 1;
    }

    if (tile.elevation === 'flat') {
      flat += 1;
      continue;
    }

    if (tile.elevation === 'hill') {
      hill += 1;
      continue;
    }

    if (tile.elevation === 'mountain') {
      mountain += 1;
    }
  }

  return {
    grassland,
    plains,
    desert,
    tundra,
    flat,
    hill,
    mountain,
    landTileCount: grassland + plains + desert + tundra,
  };
};

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

  it('keeps the archived archipelago repro seed from collapsing into hill-dominant land', () => {
    const map = generateMap(archipelagoHillBalanceRepro.request);
    const tiles: MapTile[] = map.tileKeys
      .map((key) => map.tilesByKey[key])
      .filter((tile): tile is MapTile => Boolean(tile));
    const counts = countLandTerrains(tiles);
    const lowlandShare = (counts.grassland + counts.plains) / Math.max(1, counts.landTileCount);
    const hillShare = counts.hill / Math.max(1, counts.landTileCount);
    const elevationCoverage =
      (counts.flat + counts.hill + counts.mountain) / Math.max(1, counts.landTileCount);

    expect(counts.landTileCount).toBeGreaterThan(0);
    expect(lowlandShare).toBeGreaterThanOrEqual(0.45);
    expect(hillShare).toBeLessThanOrEqual(0.35);
    expect(elevationCoverage).toBe(1);
    expect(counts.grassland).toBeGreaterThanOrEqual(counts.plains);
  });
});
