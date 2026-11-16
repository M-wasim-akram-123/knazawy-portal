import type { BaseUnit } from './enums';

/** A batch cooks one approved recipe. Its ingredients leave stock when the batch is recorded. */
export interface ProductionLineRecord {
  itemName: string;
  baseUnit: BaseUnit;
  quantityBase: string;
  cost: string;
}

export interface ProductionRecord {
  id: string;
  number: string;
  recipeId: string;
  recipeName: string;
  locationId: string;
  locationName: string;
  producedOn: string;
  plannedPortions: string;
  actualPortions: string;
  totalCost: string;
  costPerPortion: string;
  note: string | null;
  lines: ProductionLineRecord[];
}
