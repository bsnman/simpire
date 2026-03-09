import type { MapgenReproPayload } from '~/game/mapgen/repro';

export const archipelagoDiagonalReproFixture: MapgenReproPayload = {
  version: 1,
  capturedAt: '2026-03-09T22:46:37.879Z',
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
    seedHash: 'archipelago-1773096370243',
    mapId: 'game-1773096370243',
    params: {
      landRatio: 0.24,
      islandSizeBias: 0.36,
      chainTendency: 0.64,
      shelfWidth: 2,
      tectonicStrength: 0.52,
    },
  },
  metrics: {
    landRatio: 0.24,
    landTileCount: 1176,
    waterTileCount: 3724,
    landmassCount: 19,
    largestLandmassShare: 0.9030612244897959,
    coastlineComplexity: 1.3350340136054422,
    directionalityScore: 0.09469214437367307,
    dominantAxis: 0,
  },
  mapDigest: 'fnv1a:8c87b006',
};
