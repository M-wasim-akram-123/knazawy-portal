import type { BaseUnit, LocationType, Role, StorageType } from './enums';

export const BASE_UNIT_LABELS: Record<BaseUnit, string> = {
  KG: 'kg',
  LITRE: 'litre',
  PIECE: 'piece',
};

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  DRY: 'Dry',
  CHILLED: 'Chilled',
  FROZEN: 'Frozen',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  STORE: 'Main store',
  COLD_ROOM: 'Cold room',
  FREEZER: 'Freezer',
  KITCHEN: 'Kitchen',
  VEHICLE: 'Vehicle',
  BIN: 'Bin',
};

export interface ItemRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  baseUnit: BaseUnit;
  purchaseUnit: string;
  conversionToBase: string;
  reorderLevel: string;
  shelfLifeDays: number;
  storageType: StorageType;
  active: boolean;
  supplierIds: string[];
}

export interface SupplierRecord {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  paymentTermsDays: number;
  active: boolean;
  itemIds: string[];
}

export interface LocationRecord {
  id: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  active: boolean;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    organisationId: string;
  };
}
