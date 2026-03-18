import type { UnitCategoryDefinition, UnitDefinition } from '/base/units/types';

export const MILITARY_UNIT_CATEGORY_ID = 'military';
export const CIVILIAN_UNIT_CATEGORY_ID = 'civilian';

export const WARRIOR_UNIT_ID = 'warrior';
export const SETTLER_UNIT_ID = 'settler';

export const builtinUnitCategories: readonly UnitCategoryDefinition[] = [
  {
    id: MILITARY_UNIT_CATEGORY_ID,
    name: 'Military',
    description: 'Combat-focused units used to defend territory and wage war.',
  },
  {
    id: CIVILIAN_UNIT_CATEGORY_ID,
    name: 'Civilian',
    description: 'Non-combat units focused on expansion, logistics, and support.',
  },
];

export const builtinUnits: readonly UnitDefinition[] = [
  {
    id: WARRIOR_UNIT_ID,
    name: 'Warrior',
    description: 'Basic early melee combat unit.',
    categoryId: MILITARY_UNIT_CATEGORY_ID,
  },
  {
    id: SETTLER_UNIT_ID,
    name: 'Settler',
    description: 'Foundational expansion unit used to establish new cities later.',
    categoryId: CIVILIAN_UNIT_CATEGORY_ID,
  },
];
