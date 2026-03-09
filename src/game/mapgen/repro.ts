import type { GameMap, MapTile } from '~/types/map';

import type { ValidationResult, MapGenerationRequest } from '~/game/mapgen/contracts';
import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import {
  buildLandMaskFromTiles,
  calculateMapQualityMetrics,
  type MapQualityMetrics,
} from '~/game/mapgen/pipeline/metrics';

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

export type MapgenReproPayload = {
  version: 1;
  capturedAt: string;
  request: MapGenerationRequest;
  metrics: MapQualityMetrics;
  mapDigest: string;
  mapData?: {
    tileCount: number;
    tiles: MapTile[];
  };
};

export type BuildMapgenReproPayloadOptions = {
  request: MapGenerationRequest;
  map: GameMap;
  includeFullMapData?: boolean;
  capturedAt?: string;
};

export type MapgenReplayInput = {
  request: MapGenerationRequest;
  expectedMapDigest?: string;
  payload?: MapgenReproPayload;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mapTilesFromMap = (map: GameMap): MapTile[] => {
  const tiles: MapTile[] = [];

  for (const key of map.tileKeys) {
    const tile = map.tilesByKey[key];

    if (!tile) {
      continue;
    }

    tiles.push(tile);
  }

  return tiles;
};

const fnv1a = (text: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

export const createMapDigest = (map: GameMap): string => {
  const parts: string[] = [
    `layout=${map.layout}`,
    `tileSize=${map.tileSize}`,
    `origin=${map.origin.x},${map.origin.y}`,
  ];

  for (const key of map.tileKeys) {
    const tile = map.tilesByKey[key];

    if (!tile) {
      continue;
    }

    parts.push(
      `${key}|${tile.terrain}|${tile.terrainFeatureId ?? ''}|${tile.resourceId ?? ''}`,
    );
  }

  return `fnv1a:${fnv1a(parts.join(';')).toString(16).padStart(8, '0')}`;
};

export const calculateMapQualityMetricsForMap = (
  request: Pick<MapGenerationRequest, 'width' | 'height'>,
  map: GameMap,
): MapQualityMetrics => {
  const grid = createMapGrid(request.width, request.height, () =>
    createRectCoords(request.width, request.height),
  );
  const landMask = buildLandMaskFromTiles(grid, mapTilesFromMap(map));
  return calculateMapQualityMetrics(grid, landMask);
};

export const buildMapgenReproPayload = ({
  request,
  map,
  includeFullMapData = false,
  capturedAt,
}: BuildMapgenReproPayloadOptions): MapgenReproPayload => {
  const metrics = calculateMapQualityMetricsForMap(request, map);
  const payload: MapgenReproPayload = {
    version: 1,
    capturedAt: capturedAt ?? new Date().toISOString(),
    request,
    metrics,
    mapDigest: createMapDigest(map),
  };

  if (includeFullMapData) {
    const tiles = mapTilesFromMap(map).map((tile) => ({ ...tile }));
    payload.mapData = {
      tileCount: tiles.length,
      tiles,
    };
  }

  return payload;
};

export const stringifyMapgenReproPayload = (payload: MapgenReproPayload): string =>
  JSON.stringify(payload, null, 2);

const parseRequest = (candidate: unknown): ValidationResult<MapGenerationRequest> => {
  if (!isRecord(candidate)) {
    return {
      ok: false,
      error: 'Request must be a JSON object.',
    };
  }

  const algorithmId = candidate.algorithmId;
  const width = candidate.width;
  const height = candidate.height;
  const seedHash = candidate.seedHash;
  const widthValue = typeof width === 'number' ? width : Number.NaN;
  const heightValue = typeof height === 'number' ? height : Number.NaN;

  if (typeof algorithmId !== 'string' || !algorithmId.trim()) {
    return {
      ok: false,
      error: 'Request algorithmId must be a non-empty string.',
    };
  }

  if (!Number.isInteger(widthValue) || widthValue <= 0) {
    return {
      ok: false,
      error: 'Request width must be a positive integer.',
    };
  }

  if (!Number.isInteger(heightValue) || heightValue <= 0) {
    return {
      ok: false,
      error: 'Request height must be a positive integer.',
    };
  }

  if (typeof seedHash !== 'string' || !seedHash.trim()) {
    return {
      ok: false,
      error: 'Request seedHash must be a non-empty string.',
    };
  }

  const parsed: MapGenerationRequest = {
    algorithmId,
    width: widthValue,
    height: heightValue,
    seedHash,
    params: candidate.params,
  };

  if (candidate.layout === 'pointy' || candidate.layout === 'flat') {
    parsed.layout = candidate.layout;
  }

  if (typeof candidate.tileSize === 'number' && Number.isFinite(candidate.tileSize)) {
    parsed.tileSize = candidate.tileSize;
  }

  if (isRecord(candidate.origin)) {
    const originX = candidate.origin.x;
    const originY = candidate.origin.y;

    if (typeof originX === 'number' && Number.isFinite(originX)) {
      if (typeof originY === 'number' && Number.isFinite(originY)) {
        parsed.origin = {
          x: originX,
          y: originY,
        };
      }
    }
  }

  if (typeof candidate.mapId === 'string' && candidate.mapId.length > 0) {
    parsed.mapId = candidate.mapId;
  }

  return {
    ok: true,
    value: parsed,
  };
};

const parsePayloadObject = (candidate: unknown): ValidationResult<MapgenReplayInput> => {
  if (!isRecord(candidate)) {
    return {
      ok: false,
      error: 'Payload must be a JSON object.',
    };
  }

  const requestResult = parseRequest(candidate.request);

  if (!requestResult.ok) {
    return requestResult;
  }

  const expectedMapDigest =
    typeof candidate.mapDigest === 'string' && candidate.mapDigest.length > 0
      ? candidate.mapDigest
      : undefined;

  const payload =
    candidate.version === 1 && typeof candidate.capturedAt === 'string' && isRecord(candidate.metrics)
      ? (candidate as MapgenReproPayload)
      : undefined;

  return {
    ok: true,
    value: {
      request: requestResult.value,
      expectedMapDigest,
      payload,
    },
  };
};

export const parseMapgenReplayInput = (text: string): ValidationResult<MapgenReplayInput> => {
  const normalizedText = text.replace(/^\uFEFF/, '').trim();

  if (!normalizedText) {
    return {
      ok: false,
      error: 'Replay payload cannot be empty.',
    };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(normalizedText);
  } catch {
    return {
      ok: false,
      error: 'Replay payload is not valid JSON.',
    };
  }

  if (!isRecord(parsedJson)) {
    return {
      ok: false,
      error: 'Replay payload must be a JSON object.',
    };
  }

  if ('request' in parsedJson) {
    return parsePayloadObject(parsedJson);
  }

  const requestResult = parseRequest(parsedJson);

  if (!requestResult.ok) {
    return requestResult;
  }

  return {
    ok: true,
    value: {
      request: requestResult.value,
    },
  };
};
