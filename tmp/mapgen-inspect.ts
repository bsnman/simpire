import { assignVoronoiRegions } from '~/game/mapgen/pipeline/voronoi';
import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import { buildMacroMask } from '~/game/mapgen/pipeline/macro-mask';
import { generatePoissonSeeds } from '~/game/mapgen/pipeline/poisson';
import { createSubseedStreams } from '~/game/mapgen/pipeline/subseeds';
import { applyTectonicPass } from '~/game/mapgen/pipeline/tectonics';
import { applyDetailPass } from '~/game/mapgen/pipeline/detail-noise';
import { generateMap } from '~/game/mapgen';
import { createSeededRandom, hashNoiseAt } from '~/game/mapgen/random';
import { toHexKey } from '~/types/hex';

const hillRequest = {
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
} as const;

const bandingRequest = {
  algorithmId: 'archipelago',
  width: 50,
  height: 50,
  layout: 'pointy',
  tileSize: 24,
  origin: {
    x: 80,
    y: 80,
  },
  seedHash: 'archipelago-1773121679904',
  mapId: 'game-1773121679904',
  params: {
    landmassCount: 11,
    landmassCountMin: 11,
    landmassCountMax: 11,
    landmassSize: 0.36,
    landRatio: 0.24,
    chainTendency: 0.64,
    shelfWidth: 2,
    tectonicStrength: 0.52,
  },
} as const;

const summarizeLine = (request: typeof bandingRequest, q: number, rStart: number, rEnd: number) => {
  const map = generateMap(request);
  const rows = [];

  for (let r = rStart; r <= rEnd; r += 1) {
    const tile = map.tilesByKey[toHexKey(q, r)];
    rows.push({
      q,
      r,
      terrain: tile?.terrain ?? null,
      elevation: tile?.elevation ?? null,
      feature: tile?.terrainFeatureId ?? null,
    });
  }

  return rows;
};

const summarizeByQ = (request: typeof bandingRequest, qStart: number, qEnd: number) => {
  const map = generateMap(request);
  const summary: Array<{
    q: number;
    land: number;
    flat: number;
    hill: number;
    mountain: number;
    feature: number;
  }> = [];

  for (let q = qStart; q <= qEnd; q += 1) {
    const entry = {
      q,
      land: 0,
      flat: 0,
      hill: 0,
      mountain: 0,
      feature: 0,
    };

    for (let r = 0; r < request.height; r += 1) {
      const tile = map.tilesByKey[toHexKey(q, r)];

      if (!tile || tile.elevation === 'underwater') {
        continue;
      }

      entry.land += 1;

      if (tile.elevation === 'flat') {
        entry.flat += 1;
      } else if (tile.elevation === 'hill') {
        entry.hill += 1;
      } else if (tile.elevation === 'mountain') {
        entry.mountain += 1;
      }

      if (tile.terrainFeatureId) {
        entry.feature += 1;
      }
    }

    summary.push(entry);
  }

  return summary;
};

const summarizeRawElevationByQ = (request: typeof bandingRequest, qStart: number, qEnd: number) => {
  const grid = createMapGrid(request.width, request.height, () =>
    createRectCoords(request.width, request.height),
  );
  const subseeds = createSubseedStreams({
    seedHash: request.seedHash,
    createRandomStream: (name) => createSeededRandom(`${request.seedHash}::${name}`),
    noiseAtWithSeed: (stream, q, r, salt) =>
      hashNoiseAt(`${request.seedHash}::${stream}`, q, r, salt),
  });
  const macroRandom = subseeds.random('macro');
  const seeds = generatePoissonSeeds({
    width: request.width,
    height: request.height,
    minDistance: 3,
    random: macroRandom,
  });
  const voronoi = assignVoronoiRegions(grid, seeds);
  const macroMask = buildMacroMask(grid, voronoi, {
    landRatio: 0.24,
    primaryRegionTarget: 11,
    largeMassBias: 0.3,
    fragmentation: 0.42,
    chainTendency: 0.64,
    edgeOceanBias: 0.24,
    random: subseeds.random('macro'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('macro', q, r, salt),
  });
  const tectonics = applyTectonicPass(grid, voronoi, macroMask.landMask, {
    strength: 0.52,
    random: subseeds.random('elevation'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('elevation', q, r, salt),
  });
  const detailPass = applyDetailPass(grid, macroMask.landMask, tectonics.elevation, {
    coastlineRoughness: 0.7,
    targetLandRatio: 0.24,
    random: subseeds.random('detail'),
    noiseAt: (q, r, salt) => subseeds.noiseAt('detail', q, r, salt),
    regionScoreByTile: macroMask.regionScoreByTile,
  });

  const summary: Array<{ q: number; average: number; count: number }> = [];

  for (let q = qStart; q <= qEnd; q += 1) {
    let total = 0;
    let count = 0;

    for (let r = 0; r < request.height; r += 1) {
      const tileIndex = grid.keyToIndex.get(toHexKey(q, r));

      if (typeof tileIndex !== 'number' || !macroMask.landMask[tileIndex]) {
        continue;
      }

      total += detailPass.elevation[tileIndex] ?? 0;
      count += 1;
    }

    summary.push({
      q,
      average: count > 0 ? total / count : 0,
      count,
    });
  }

  return summary;
};

const countLandTerrains = (request: typeof hillRequest) => {
  const map = generateMap(request);
  let grassland = 0;
  let plains = 0;
  let desert = 0;
  let tundra = 0;
  let flat = 0;
  let hill = 0;
  let mountain = 0;

  for (const key of map.tileKeys) {
    const tile = map.tilesByKey[key];

    if (!tile) {
      continue;
    }

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
    } else if (tile.elevation === 'hill') {
      hill += 1;
    } else if (tile.elevation === 'mountain') {
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

console.log(
  JSON.stringify(
    {
      hillBalance: countLandTerrains(hillRequest),
      elevationLine: summarizeLine(bandingRequest, 19, 20, 39),
      featureLine: summarizeLine(bandingRequest, 18, 18, 39),
      featureLineQ14: summarizeLine(bandingRequest, 14, 10, 25),
      featureLineQ15: summarizeLine(bandingRequest, 15, 10, 25),
      qSummary: summarizeByQ(bandingRequest, 10, 24),
      rawElevationByQ: summarizeRawElevationByQ(bandingRequest, 10, 24),
    },
    null,
    2,
  ),
);
