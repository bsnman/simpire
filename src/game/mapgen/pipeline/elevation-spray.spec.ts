import { createRectCoords } from '~/game/mapgen/helpers';
import { createMapGrid } from '~/game/mapgen/pipeline/grid';
import { applyElevationSpray } from '~/game/mapgen/pipeline/elevation-spray';
import { createSeededRandom } from '~/game/mapgen/random';
import type { MapTile } from '~/types/map';

const createLandTiles = (
  width: number,
  height: number,
  underwaterIndices = new Set<number>(),
): { grid: ReturnType<typeof createMapGrid>; tiles: MapTile[] } => {
  const grid = createMapGrid(width, height, () => createRectCoords(width, height));
  const tiles = grid.tiles.map((tile, index) => {
    if (underwaterIndices.has(index)) {
      return {
        q: tile.q,
        r: tile.r,
        terrain: 'ocean' as const,
        elevation: 'underwater' as const,
      };
    }

    return {
      q: tile.q,
      r: tile.r,
      terrain: 'grassland' as const,
      elevation: 'flat' as const,
    };
  });

  return {
    grid,
    tiles,
  };
};

describe('elevation spray stage', () => {
  it('is deterministic for identical seed and density', () => {
    const { grid, tiles } = createLandTiles(40, 25);

    const first = applyElevationSpray(grid, tiles, {
      density: 1,
      random: createSeededRandom('spray-deterministic'),
    });
    const second = applyElevationSpray(grid, tiles, {
      density: 1,
      random: createSeededRandom('spray-deterministic'),
    });

    expect(first).toEqual(second);
  });

  it('leaves tiles unchanged when density is zero', () => {
    const { grid, tiles } = createLandTiles(20, 10);

    const sprayed = applyElevationSpray(grid, tiles, {
      density: 0,
      random: createSeededRandom('spray-zero'),
    });

    expect(sprayed).toEqual(tiles);
  });

  it('changes only land elevation values when enabled', () => {
    const underwaterIndices = new Set([0]);
    const { grid, tiles } = createLandTiles(40, 25, underwaterIndices);

    const sprayed = applyElevationSpray(grid, tiles, {
      density: 1,
      random: createSeededRandom('spray-land-only'),
    });

    let changedLandTiles = 0;

    for (let index = 0; index < sprayed.length; index += 1) {
      const before = tiles[index];
      const after = sprayed[index];

      expect(after?.terrain).toBe(before?.terrain);

      if (before?.elevation === 'underwater') {
        expect(after?.elevation).toBe('underwater');
        continue;
      }

      expect(['flat', 'hill', 'mountain']).toContain(after?.elevation);

      if (after?.elevation !== before?.elevation) {
        changedLandTiles += 1;
      }
    }

    expect(changedLandTiles).toBeGreaterThan(0);
  });

  it('keeps underwater-only maps fully underwater', () => {
    const { grid, tiles } = createLandTiles(
      30,
      20,
      new Set(Array.from({ length: 600 }, (_, index) => index)),
    );

    const sprayed = applyElevationSpray(grid, tiles, {
      density: 1,
      random: createSeededRandom('spray-underwater'),
    });

    expect(sprayed).toEqual(tiles);
    expect(sprayed.every((tile) => tile.elevation === 'underwater')).toBe(true);
  });
});
