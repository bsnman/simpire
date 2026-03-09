import { CONTINENTS_GENERATOR_ID, generateMap } from '~/game/mapgen';
import {
  buildMapgenReproPayload,
  calculateMapQualityMetricsForMap,
  createMapDigest,
  parseMapgenReplayInput,
  stringifyMapgenReproPayload,
} from '~/game/mapgen/repro';

describe('mapgen repro helpers', () => {
  const request = {
    algorithmId: CONTINENTS_GENERATOR_ID,
    width: 28,
    height: 22,
    seedHash: 'mapgen-repro-seed',
    params: {
      landRatio: 0.32,
      continentCountTarget: 3,
      tectonicStrength: 0.62,
      coastlineRoughness: 0.57,
      mountainIntensity: 0.56,
    },
  };

  it('builds deterministic payload fields for a generated map', () => {
    const map = generateMap(request);
    const payload = buildMapgenReproPayload({
      request,
      map,
      includeFullMapData: true,
      capturedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(payload.version).toBe(1);
    expect(payload.capturedAt).toBe('2026-03-10T00:00:00.000Z');
    expect(payload.request).toEqual(request);
    expect(payload.metrics).toEqual(calculateMapQualityMetricsForMap(request, map));
    expect(payload.mapDigest).toBe(createMapDigest(map));
    expect(payload.mapData?.tileCount).toBe(map.tileKeys.length);
    expect(payload.mapData?.tiles.length).toBe(map.tileKeys.length);
  });

  it('parses replay input from both full payload JSON and request JSON', () => {
    const map = generateMap(request);
    const payload = buildMapgenReproPayload({
      request,
      map,
      capturedAt: '2026-03-10T00:00:00.000Z',
    });

    const payloadParse = parseMapgenReplayInput(stringifyMapgenReproPayload(payload));
    const requestParse = parseMapgenReplayInput(JSON.stringify(request));

    expect(payloadParse.ok).toBe(true);
    expect(requestParse.ok).toBe(true);

    if (payloadParse.ok) {
      expect(payloadParse.value.request).toEqual(request);
      expect(payloadParse.value.expectedMapDigest).toBe(payload.mapDigest);
    }

    if (requestParse.ok) {
      expect(requestParse.value.request).toEqual(request);
      expect(requestParse.value.expectedMapDigest).toBeUndefined();
    }
  });

  it('rejects invalid replay payloads', () => {
    expect(parseMapgenReplayInput('')).toEqual({
      ok: false,
      error: 'Replay payload cannot be empty.',
    });

    expect(parseMapgenReplayInput('{nope')).toEqual({
      ok: false,
      error: 'Replay payload is not valid JSON.',
    });

    expect(parseMapgenReplayInput('{"seedHash":"a"}')).toEqual({
      ok: false,
      error: 'Request algorithmId must be a non-empty string.',
    });
  });
});
