import {
  canPlaceResourceOnTerrain,
  getResourcesForTerrain,
  resources,
  type ResourceType,
} from '~/base/resources';

const getResourceBonusValue = (resourceType: ResourceType): number => {
  const bonusProduction = resources[resourceType].bonusProduction ?? {};
  return (bonusProduction.food ?? 0) + (bonusProduction.hammer ?? 0) + (bonusProduction.gold ?? 0);
};

describe('resources', () => {
  it('models a broad economic resource roster without forest entries', () => {
    expect(Object.keys(resources)).toEqual(
      expect.arrayContaining([
        'stone',
        'clay',
        'iron_ore',
        'bronze_ore',
        'coal',
        'gold_ore',
        'gems',
        'fish',
        'crab',
        'tuna',
        'pearls',
        'whales',
        'wheat',
        'rice',
        'cattle',
        'sheep',
        'salt',
        'spices',
      ]),
    );
    expect(Object.keys(resources)).not.toContain('forest');
  });

  it('enforces terrain placement rules for land and water resources', () => {
    expect(canPlaceResourceOnTerrain('gems', 'plains', 'hill')).toBe(true);
    expect(canPlaceResourceOnTerrain('gems', 'grassland', 'flat')).toBe(false);
    expect(canPlaceResourceOnTerrain('fish', 'coastal_sea')).toBe(true);
    expect(canPlaceResourceOnTerrain('fish', 'plains')).toBe(false);
    expect(canPlaceResourceOnTerrain('whales', 'ocean')).toBe(true);
    expect(canPlaceResourceOnTerrain('whales', 'coastal_sea')).toBe(false);
  });

  it('keeps balance bands coherent by rarity tier', () => {
    const resourceTypes = Object.keys(resources) as ResourceType[];

    for (const resourceType of resourceTypes) {
      const resource = resources[resourceType];
      const bonusValue = getResourceBonusValue(resourceType);

      if (resource.rarity === 'common') {
        expect(resource.spawnWeight).toBeGreaterThanOrEqual(1);
        expect(bonusValue).toBeLessThanOrEqual(1);
        continue;
      }

      if (resource.rarity === 'uncommon') {
        expect(resource.spawnWeight).toBeGreaterThanOrEqual(0.6);
        expect(resource.spawnWeight).toBeLessThan(1);
        expect(bonusValue).toBeLessThanOrEqual(2);
        continue;
      }

      expect(resource.spawnWeight).toBeLessThan(0.5);
      expect(bonusValue).toBeLessThanOrEqual(3);
    }
  });

  it('exposes terrain-to-resource lookup helper', () => {
    expect(getResourcesForTerrain('grassland')).toEqual(
      expect.arrayContaining(['wheat', 'rice', 'cattle']),
    );
    expect(getResourcesForTerrain('plains', 'mountain')).toEqual(
      expect.arrayContaining(['stone', 'gold_ore', 'gems']),
    );
    expect(getResourcesForTerrain('ocean')).toEqual(expect.arrayContaining(['tuna', 'whales']));
  });
});
