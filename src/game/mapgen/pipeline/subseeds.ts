import type { MapGeneratorContext } from '~/game/mapgen/contracts';
import { createSeededRandom, hashNoiseAt, type SeededRandom } from '~/game/mapgen/random';

export const deriveSubseed = (seedHash: string, streamName: string): string =>
  `${seedHash}::${streamName}`;

export const createSubseedRandom = (seedHash: string, streamName: string): SeededRandom =>
  createSeededRandom(deriveSubseed(seedHash, streamName));

export const noiseAtFromSubseed = (
  seedHash: string,
  streamName: string,
  q: number,
  r: number,
  salt?: string,
): number => hashNoiseAt(deriveSubseed(seedHash, streamName), q, r, salt);

export type SubseedStreams = {
  random: (streamName: string) => SeededRandom;
  noiseAt: (streamName: string, q: number, r: number, salt?: string) => number;
};

export const createSubseedStreams = (
  context: Pick<MapGeneratorContext, 'seedHash' | 'createRandomStream' | 'noiseAtWithSeed'>,
): SubseedStreams => {
  return {
    random: (streamName: string) =>
      context.createRandomStream?.(streamName) ?? createSubseedRandom(context.seedHash, streamName),
    noiseAt: (streamName: string, q: number, r: number, salt?: string) =>
      context.noiseAtWithSeed?.(streamName, q, r, salt) ??
      noiseAtFromSubseed(context.seedHash, streamName, q, r, salt),
  };
};
