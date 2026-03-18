import type { UnitCategoryDefinition, UnitDefinition } from '/base/units/types';

type RegistrationOptions = {
  allowOverwrite?: boolean;
};

export type UnitCategoryRegistrationOptions = RegistrationOptions;
export type UnitRegistrationOptions = RegistrationOptions;

const toStoredDefinition = <TDefinition extends Record<string, string>>(
  definition: TDefinition,
): Readonly<TDefinition> => Object.freeze({ ...definition });

const validateNonEmptyString = (value: string, fieldName: string, subject: string) => {
  if (value.trim().length === 0) {
    throw new Error(`${subject} ${fieldName} must be a non-empty string.`);
  }
};

const validateUnitCategoryDefinition = (definition: UnitCategoryDefinition) => {
  validateNonEmptyString(definition.id, 'id', 'Unit category');
  validateNonEmptyString(definition.name, 'name', 'Unit category');
};

const validateUnitDefinition = (definition: UnitDefinition) => {
  validateNonEmptyString(definition.id, 'id', 'Unit');
  validateNonEmptyString(definition.name, 'name', 'Unit');
  validateNonEmptyString(definition.categoryId, 'categoryId', 'Unit');
};

export class UnitCategoryRegistry {
  private readonly categories = new Map<string, Readonly<UnitCategoryDefinition>>();

  register(
    definition: UnitCategoryDefinition,
    options: UnitCategoryRegistrationOptions = {},
  ): void {
    validateUnitCategoryDefinition(definition);

    if (this.categories.has(definition.id) && !options.allowOverwrite) {
      throw new Error(`Unit category "${definition.id}" is already registered.`);
    }

    this.categories.set(definition.id, toStoredDefinition(definition));
  }

  get(id: string): Readonly<UnitCategoryDefinition> | undefined {
    return this.categories.get(id);
  }

  listIds(): string[] {
    return [...this.categories.keys()].sort();
  }
}

export class UnitRegistry {
  private readonly units = new Map<string, Readonly<UnitDefinition>>();
  private readonly getUnitCategoryLookup: (
    categoryId: string,
  ) => Readonly<UnitCategoryDefinition> | undefined;

  constructor(
    getUnitCategory: (categoryId: string) => Readonly<UnitCategoryDefinition> | undefined,
  ) {
    this.getUnitCategoryLookup = getUnitCategory;
  }

  register(definition: UnitDefinition, options: UnitRegistrationOptions = {}): void {
    validateUnitDefinition(definition);

    if (!this.getUnitCategoryLookup(definition.categoryId)) {
      throw new Error(
        `Unit "${definition.id}" references unknown unit category "${definition.categoryId}".`,
      );
    }

    if (this.units.has(definition.id) && !options.allowOverwrite) {
      throw new Error(`Unit "${definition.id}" is already registered.`);
    }

    this.units.set(definition.id, toStoredDefinition(definition));
  }

  get(id: string): Readonly<UnitDefinition> | undefined {
    return this.units.get(id);
  }

  listIds(): string[] {
    return [...this.units.keys()].sort();
  }
}
