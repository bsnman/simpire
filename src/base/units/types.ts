export type UnitCategoryDefinition = {
  id: string;
  name: string;
  description: string;
};

export type UnitDefinition = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
};
