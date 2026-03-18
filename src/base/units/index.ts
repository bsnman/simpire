import { builtinUnitCategories, builtinUnits } from '/base/units/builtins';
import {
  UnitCategoryRegistry,
  UnitRegistry,
  type UnitCategoryRegistrationOptions,
  type UnitRegistrationOptions,
} from '/base/units/registry';
import type { UnitCategoryDefinition, UnitDefinition } from '/base/units/types';

export type { UnitCategoryDefinition, UnitDefinition } from '/base/units/types';
export type {
  UnitCategoryRegistrationOptions,
  UnitRegistrationOptions,
} from '/base/units/registry';
export {
  CIVILIAN_UNIT_CATEGORY_ID,
  MILITARY_UNIT_CATEGORY_ID,
  SETTLER_UNIT_ID,
  WARRIOR_UNIT_ID,
} from '/base/units/builtins';

const unitCategoryRegistry = new UnitCategoryRegistry();
const unitRegistry = new UnitRegistry((categoryId) => unitCategoryRegistry.get(categoryId));

for (const unitCategory of builtinUnitCategories) {
  unitCategoryRegistry.register(unitCategory);
}

for (const unit of builtinUnits) {
  unitRegistry.register(unit);
}

export const registerUnitCategory = (
  definition: UnitCategoryDefinition,
  options?: UnitCategoryRegistrationOptions,
): void => {
  unitCategoryRegistry.register(definition, options);
};

export const getUnitCategory = (id: string) => unitCategoryRegistry.get(id);

export const listUnitCategoryIds = (): string[] => unitCategoryRegistry.listIds();

export const registerUnit = (
  definition: UnitDefinition,
  options?: UnitRegistrationOptions,
): void => {
  unitRegistry.register(definition, options);
};

export const getUnitDefinition = (id: string) => unitRegistry.get(id);

export const listUnitIds = (): string[] => unitRegistry.listIds();
