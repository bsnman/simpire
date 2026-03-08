const UINT32_MAX_PLUS_ONE = 4_294_967_296;
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;

type SeedFactory = () => number;

const xmur3 = (text: string): SeedFactory => {
  let hash = 1_779_033_703 ^ text.length;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 3_432_918_353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_507);
    hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
};

const sfc32 = (a: number, b: number, c: number, d: number) => {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;

    const sum = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const total = (sum + d) | 0;
    c = (c + total) | 0;

    return (total >>> 0) / UINT32_MAX_PLUS_ONE;
  };
};

const fnv1a = (text: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

export type SeededRandom = {
  next: () => number;
  int: (minInclusive: number, maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
};

export const createSeededRandom = (seedHash: string): SeededRandom => {
  const createSeed = xmur3(seedHash);
  const nextValue = sfc32(createSeed(), createSeed(), createSeed(), createSeed());

  return {
    next: nextValue,
    int: (minInclusive, maxExclusive) => {
      if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive)) {
        throw new Error('Seeded random bounds must be finite numbers.');
      }

      if (maxExclusive <= minInclusive) {
        throw new Error('Seeded random requires maxExclusive > minInclusive.');
      }

      return Math.floor(nextValue() * (maxExclusive - minInclusive)) + minInclusive;
    },
    pick: <T>(items: readonly T[]) => {
      if (!items.length) {
        throw new Error('Seeded random cannot pick from an empty list.');
      }

      const value = items[Math.floor(nextValue() * items.length)];

      if (typeof value === 'undefined') {
        throw new Error('Seeded random failed to pick an item from list.');
      }

      return value;
    },
  };
};

export const hashNoiseAt = (seedHash: string, q: number, r: number, salt = 'terrain'): number => {
  const hash = fnv1a(`${seedHash}|${salt}|${q},${r}`);
  return hash / UINT32_MAX_PLUS_ONE;
};
