import type { GameMap, MapTile } from '~/types/map';
import { toHexKey } from '~/types/hex';

import type {
  MapGenerationRequest,
  MapGeneratorContext,
  MapGeneratorDefinition,
  MapGeneratorRegistrationOptions,
} from '~/game/mapgen/contracts';
import { createRectCoords } from '~/game/mapgen/helpers';
import { hashNoiseAt, createSeededRandom } from '~/game/mapgen/random';

const DEFAULT_LAYOUT = 'pointy' as const;
const DEFAULT_TILE_SIZE = 24;
const DEFAULT_ORIGIN = {
  x: 80,
  y: 80,
};

type NormalizedMapGenerationRequest = {
  algorithmId: string;
  width: number;
  height: number;
  seedHash: string;
  params: unknown;
  layout: 'pointy' | 'flat';
  tileSize: number;
  origin: {
    x: number;
    y: number;
  };
  mapId: string;
};

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

const normalizeRequest = (request: MapGenerationRequest): NormalizedMapGenerationRequest => {
  if (!request.algorithmId) {
    throw new Error('Map generation requires a non-empty algorithmId.');
  }

  if (!request.seedHash) {
    throw new Error('Map generation requires a non-empty seedHash.');
  }

  if (!isPositiveInteger(request.width) || !isPositiveInteger(request.height)) {
    throw new Error('Map generation width and height must be positive integers.');
  }

  const layout = request.layout ?? DEFAULT_LAYOUT;

  if (layout !== 'pointy' && layout !== 'flat') {
    throw new Error(`Unsupported hex layout "${layout}".`);
  }

  const tileSize = request.tileSize ?? DEFAULT_TILE_SIZE;

  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    throw new Error('Map generation tileSize must be a positive finite number.');
  }

  const origin = request.origin ?? DEFAULT_ORIGIN;

  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y)) {
    throw new Error('Map generation origin coordinates must be finite numbers.');
  }

  return {
    algorithmId: request.algorithmId,
    width: request.width,
    height: request.height,
    seedHash: request.seedHash,
    params: request.params,
    layout,
    tileSize,
    origin: {
      x: origin.x,
      y: origin.y,
    },
    mapId:
      request.mapId ??
      `${request.algorithmId}:${request.seedHash}:${request.width}x${request.height}`,
  };
};

const buildMapFromTiles = (
  normalized: NormalizedMapGenerationRequest,
  tiles: MapTile[],
): GameMap => {
  const tilesByKey: GameMap['tilesByKey'] = {};
  const tileKeys: GameMap['tileKeys'] = [];

  for (const tile of tiles) {
    const key = toHexKey(tile.q, tile.r);

    if (tilesByKey[key]) {
      throw new Error(`Map generator produced duplicate tile key "${key}".`);
    }

    tilesByKey[key] = tile;
    tileKeys.push(key);
  }

  return {
    id: normalized.mapId,
    layout: normalized.layout,
    tileSize: normalized.tileSize,
    origin: normalized.origin,
    tilesByKey,
    tileKeys,
  };
};

export class MapGeneratorRegistry {
  private readonly generators = new Map<string, MapGeneratorDefinition<unknown>>();

  register<TParams>(
    definition: MapGeneratorDefinition<TParams>,
    options: MapGeneratorRegistrationOptions = {},
  ) {
    const { allowOverwrite = false } = options;
    const existing = this.generators.get(definition.id);

    if (existing && !allowOverwrite) {
      throw new Error(`Map generator "${definition.id}" is already registered.`);
    }

    this.generators.set(definition.id, definition as MapGeneratorDefinition<unknown>);
  }

  get(algorithmId: string): MapGeneratorDefinition<unknown> | undefined {
    return this.generators.get(algorithmId);
  }

  listIds(): string[] {
    return [...this.generators.keys()].sort();
  }

  generate(request: MapGenerationRequest): GameMap {
    const normalized = normalizeRequest(request);
    const definition = this.generators.get(normalized.algorithmId);

    if (!definition) {
      throw new Error(`Map generator "${normalized.algorithmId}" is not registered.`);
    }

    const validatedParams = definition.validateParams(normalized.params);

    if (!validatedParams.ok) {
      throw new Error(
        `Invalid params for map generator "${normalized.algorithmId}": ${validatedParams.error}`,
      );
    }

    const random = createSeededRandom(normalized.seedHash);
    const streamSeed = (name: string) => `${normalized.seedHash}::${name}`;
    const context: MapGeneratorContext = {
      width: normalized.width,
      height: normalized.height,
      seedHash: normalized.seedHash,
      layout: normalized.layout,
      tileSize: normalized.tileSize,
      origin: normalized.origin,
      random,
      noiseAt: (q, r, salt) => hashNoiseAt(normalized.seedHash, q, r, salt),
      createRandomStream: (name) => createSeededRandom(streamSeed(name)),
      noiseAtWithSeed: (stream, q, r, salt) => hashNoiseAt(streamSeed(stream), q, r, salt),
      createRectCoords: () => createRectCoords(normalized.width, normalized.height),
    };

    const tiles = definition.generateTiles(context, validatedParams.value);
    return buildMapFromTiles(normalized, tiles);
  }
}
