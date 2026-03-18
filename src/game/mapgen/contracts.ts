import type { HexCoord, HexLayout } from '/types/hex';
import type { MapTile } from '/types/map';

import type { SeededRandom } from '/game/mapgen/random';

export type MapGenerationRequest = {
  algorithmId: string;
  width: number;
  height: number;
  seedHash: string;
  params?: unknown;
  layout?: HexLayout;
  tileSize?: number;
  origin?: {
    x: number;
    y: number;
  };
  mapId?: string;
};

export type MapGeneratorContext = {
  width: number;
  height: number;
  seedHash: string;
  layout: HexLayout;
  tileSize: number;
  origin: {
    x: number;
    y: number;
  };
  random: SeededRandom;
  noiseAt: (q: number, r: number, salt?: string) => number;
  createRandomStream: (name: string) => SeededRandom;
  noiseAtWithSeed: (stream: string, q: number, r: number, salt?: string) => number;
  createRectCoords: () => HexCoord[];
};

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

export type MapGeneratorNumericParameterDefinition = {
  key: string;
  label: string;
  description?: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
};

export type MapGeneratorDefinition<TParams = unknown> = {
  id: string;
  displayName?: string;
  description?: string;
  parameterDefinitions?: MapGeneratorNumericParameterDefinition[];
  validateParams: (params: unknown) => ValidationResult<TParams>;
  generateTiles: (context: MapGeneratorContext, params: TParams) => MapTile[];
};

export type MapGeneratorRegistrationOptions = {
  allowOverwrite?: boolean;
};
