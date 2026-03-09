import { canPlaceTerrainFeatureOnTerrain, terrainFeatures } from '~/base/terrainFeatures';

describe('terrainFeatures', () => {
  it('contains vegetation/cover entries separate from resource definitions', () => {
    expect(Object.keys(terrainFeatures)).toEqual(
      expect.arrayContaining(['forest', 'jungle', 'bamboo_grove', 'reeds']),
    );
  });

  it('enforces terrain placement rules for terrain features', () => {
    expect(canPlaceTerrainFeatureOnTerrain('forest', 'grassland')).toBe(true);
    expect(canPlaceTerrainFeatureOnTerrain('forest', 'coastal_sea')).toBe(false);
    expect(canPlaceTerrainFeatureOnTerrain('reeds', 'coastal_sea')).toBe(true);
    expect(canPlaceTerrainFeatureOnTerrain('reeds', 'mountain')).toBe(false);
  });
});
