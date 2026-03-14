import { createSeededRandom } from '~/game/mapgen/random';
import { createRectCoords } from '~/game/mapgen/helpers';
import {
  buildDeterministicShuffle,
  createMapGrid,
  type MapGrid,
} from '~/game/mapgen/pipeline/grid';
import {
  createSubseedRandom,
  createSubseedStreams,
  noiseAtFromSubseed,
} from '~/game/mapgen/pipeline/subseeds';
import { sampleIsotropicField } from '~/game/mapgen/pipeline/isotropic-noise';

const collectNeighborSymmetryViolations = (grid: MapGrid): number => {
  let violations = 0;

  for (let tileIndex = 0; tileIndex < grid.tiles.length; tileIndex += 1) {
    const neighbors = grid.neighborsByIndex[tileIndex] ?? [];

    for (const neighborIndex of neighbors) {
      if (neighborIndex < 0) {
        continue;
      }

      const reverseNeighbors = grid.neighborsByIndex[neighborIndex] ?? [];

      if (!reverseNeighbors.includes(tileIndex)) {
        violations += 1;
      }
    }
  }

  return violations;
};

describe('mapgen deterministic foundations', () => {
  it('derives deterministic subseed streams and noise fields', () => {
    const firstRandom = createSubseedRandom('seed-alpha', 'macro');
    const secondRandom = createSubseedRandom('seed-alpha', 'macro');

    const firstSequence = Array.from({ length: 5 }, () => firstRandom.next());
    const secondSequence = Array.from({ length: 5 }, () => secondRandom.next());

    expect(firstSequence).toEqual(secondSequence);

    const macroNoise = noiseAtFromSubseed('seed-alpha', 'macro', 4, 9, 'field-a');
    const macroNoiseRepeat = noiseAtFromSubseed('seed-alpha', 'macro', 4, 9, 'field-a');
    const detailNoise = noiseAtFromSubseed('seed-alpha', 'detail', 4, 9, 'field-a');

    expect(macroNoise).toBe(macroNoiseRepeat);
    expect(detailNoise).not.toBe(macroNoise);
  });

  it('supports context-provided stream helpers via createSubseedStreams', () => {
    const streams = createSubseedStreams({
      seedHash: 'seed-beta',
      createRandomStream: (name) => createSeededRandom(`stream-${name}`),
      noiseAtWithSeed: (stream, q, r, salt) =>
        (Number(`${stream.length}${q}${r}${(salt ?? '').length}`) % 101) / 100,
    });

    expect(streams.random('macro').next()).toBe(createSeededRandom('stream-macro').next());
    expect(streams.noiseAt('detail', 2, 3, 'x')).toBe(0.7);
  });

  it('creates deterministic shuffled iteration order', () => {
    const randomA = createSeededRandom('shuffle-seed');
    const randomB = createSeededRandom('shuffle-seed');

    expect(buildDeterministicShuffle(25, randomA)).toEqual(buildDeterministicShuffle(25, randomB));
  });

  it('samples isotropic fields deterministically without collapsing to direct axial hashes', () => {
    const noiseAt = (q: number, r: number, salt?: string) => noiseAtFromSubseed('seed-gamma', 'climate', q, r, salt);
    const isotropic = sampleIsotropicField(7, 11, noiseAt, 'field-a');
    const isotropicRepeat = sampleIsotropicField(7, 11, noiseAt, 'field-a');
    const direct = noiseAt(7, 11, 'field-a');

    expect(isotropic).toBe(isotropicRepeat);
    expect(isotropic).not.toBe(direct);
    expect(isotropic).toBeGreaterThanOrEqual(0);
    expect(isotropic).toBeLessThanOrEqual(1);
  });

  it('builds a symmetric hex-neighbor graph', () => {
    const grid = createMapGrid(20, 16, () => createRectCoords(20, 16));

    expect(grid.tiles).toHaveLength(320);
    expect(collectNeighborSymmetryViolations(grid)).toBe(0);
  });
});
