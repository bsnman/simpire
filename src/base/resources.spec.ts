import { canPlaceResourceOnTerrain, resources } from '~/base/resources';

describe('resources', () => {
  it('models economic resources without forest entries', () => {
    expect(Object.keys(resources)).toEqual(
      expect.arrayContaining([
        'iron_ore',
        'gold_ore',
        'bronze_ore',
        'fish',
        'crab',
        'wheat',
        'rice',
        'gems',
      ]),
    );
    expect(Object.keys(resources)).not.toContain('forest');
  });

  it('enforces terrain placement rules for land and water resources', () => {
    expect(canPlaceResourceOnTerrain('gems', 'hill')).toBe(true);
    expect(canPlaceResourceOnTerrain('gems', 'grassland')).toBe(false);
    expect(canPlaceResourceOnTerrain('fish', 'coastal_sea')).toBe(true);
    expect(canPlaceResourceOnTerrain('fish', 'plains')).toBe(false);
  });
});
