import { generateMap } from '~/game/mapgen';
import {
  calculateMapQualityMetricsForMap,
  createMapDigest,
  parseMapgenReplayInput,
  stringifyMapgenReproPayload,
} from '~/game/mapgen/repro';
import { archipelagoDiagonalReproFixture } from '~/game/mapgen/fixtures/archipelagoDiagonalRepro';

describe('mapgen repro fixtures', () => {
  it('replays archipelago diagonal repro payload deterministically', () => {
    const map = generateMap(archipelagoDiagonalReproFixture.request);
    const digest = createMapDigest(map);
    const metrics = calculateMapQualityMetricsForMap(archipelagoDiagonalReproFixture.request, map);

    expect(digest).toBe(archipelagoDiagonalReproFixture.mapDigest);
    expect(metrics).toEqual(archipelagoDiagonalReproFixture.metrics);
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
