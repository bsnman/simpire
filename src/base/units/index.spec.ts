import { beforeEach, describe, expect, it, vi } from 'vitest';

type UnitsModule = typeof import('/base/units');

describe('units', () => {
  let units: UnitsModule;

  beforeEach(async () => {
    vi.resetModules();
    units = await import('/base/units');
  });

  it('registers built-in categories and units on bootstrap', () => {
    expect(units.listUnitCategoryIds()).toEqual(['civilian', 'military']);
    expect(units.listUnitIds()).toEqual(['settler', 'warrior']);
    expect(units.getUnitCategory(units.MILITARY_UNIT_CATEGORY_ID)).toEqual({
      id: 'military',
      name: 'Military',
      description: 'Combat-focused units used to defend territory and wage war.',
    });
    expect(units.getUnitDefinition(units.WARRIOR_UNIT_ID)).toEqual({
      id: 'warrior',
      name: 'Warrior',
      description: 'Basic early melee combat unit.',
      categoryId: 'military',
    });
  });

  it('resolves built-in units to their categories', () => {
    expect(units.getUnitDefinition(units.WARRIOR_UNIT_ID)?.categoryId).toBe(
      units.MILITARY_UNIT_CATEGORY_ID,
    );
    expect(units.getUnitDefinition(units.SETTLER_UNIT_ID)?.categoryId).toBe(
      units.CIVILIAN_UNIT_CATEGORY_ID,
    );
  });

  it('rejects units that reference unknown categories', () => {
    expect(() =>
      units.registerUnit({
        id: 'scout',
        name: 'Scout',
        description: 'Fast recon unit.',
        categoryId: 'recon',
      }),
    ).toThrow('unknown unit category "recon"');
  });

  it('rejects duplicate unit and category ids unless overwrite is enabled', () => {
    expect(() =>
      units.registerUnitCategory({
        id: units.CIVILIAN_UNIT_CATEGORY_ID,
        name: 'Civilian Duplicate',
        description: 'Duplicate category.',
      }),
    ).toThrow('already registered');

    units.registerUnitCategory(
      {
        id: units.CIVILIAN_UNIT_CATEGORY_ID,
        name: 'Civilian Support',
        description: 'Updated civilian category.',
      },
      { allowOverwrite: true },
    );

    expect(units.getUnitCategory(units.CIVILIAN_UNIT_CATEGORY_ID)).toEqual({
      id: 'civilian',
      name: 'Civilian Support',
      description: 'Updated civilian category.',
    });

    expect(() =>
      units.registerUnit({
        id: units.WARRIOR_UNIT_ID,
        name: 'Warrior Duplicate',
        description: 'Duplicate unit.',
        categoryId: units.MILITARY_UNIT_CATEGORY_ID,
      }),
    ).toThrow('already registered');

    units.registerUnit(
      {
        id: units.WARRIOR_UNIT_ID,
        name: 'Warrior Veteran',
        description: 'Updated warrior unit.',
        categoryId: units.MILITARY_UNIT_CATEGORY_ID,
      },
      { allowOverwrite: true },
    );

    expect(units.getUnitDefinition(units.WARRIOR_UNIT_ID)).toEqual({
      id: 'warrior',
      name: 'Warrior Veteran',
      description: 'Updated warrior unit.',
      categoryId: 'military',
    });
  });

  it('lists category and unit ids in sorted order', () => {
    units.registerUnitCategory({
      id: 'support',
      name: 'Support',
      description: 'Auxiliary non-combat unit category.',
    });

    units.registerUnit({
      id: 'builder',
      name: 'Builder',
      description: 'Improves nearby territory.',
      categoryId: units.CIVILIAN_UNIT_CATEGORY_ID,
    });

    units.registerUnit({
      id: 'archer',
      name: 'Archer',
      description: 'Basic ranged combat unit.',
      categoryId: units.MILITARY_UNIT_CATEGORY_ID,
    });

    expect(units.listUnitCategoryIds()).toEqual(['civilian', 'military', 'support']);
    expect(units.listUnitIds()).toEqual(['archer', 'builder', 'settler', 'warrior']);
  });
});
