import type { TokenStore } from '@knazawy/auth-client';
import type {
  AccountRecord,
  AirlineRecord,
  AirlineRole,
  DeliveryPoint,
  GoodsReceiptRecord,
  ItemRecord,
  LocationRecord,
  LoginResult,
  MealCostRecord,
  MenuItemRecord,
  ProductionRecord,
  PurchaseRecord,
  RecipeKind,
  RecipeRecord,
  StockCountRecord,
  StockIssueReason,
  StockIssueRecord,
  StockOnHandRecord,
  StockTransferRecord,
  ServiceRequestRecord,
  SupplierRecord,
} from '@knazawy/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AirlineInput {
  code: string;
  name: string;
  taxNumber?: string;
}

export interface AirlineUserInput {
  name: string;
  email: string;
  role: AirlineRole;
  password: string;
}

export interface AirlineUserChange {
  name?: string;
  email?: string;
  role?: AirlineRole;
  status?: 'ACTIVE' | 'DISABLED';
  password?: string;
}

export interface ItemInput {
  code: string;
  name: string;
  category: string;
  baseUnit: ItemRecord['baseUnit'];
  purchaseUnit: string;
  conversionToBase: string;
  reorderLevel: string;
  shelfLifeDays: number;
  storageType: ItemRecord['storageType'];
  supplierIds?: string[];
}

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
  paymentTermsDays: number;
  itemIds?: string[];
}

export interface LocationInput {
  name: string;
  type: LocationRecord['type'];
  parentId?: string;
}

export interface PurchaseLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
}

export interface PurchaseInput {
  supplierId: string;
  orderedOn: string;
  lines: PurchaseLineInput[];
}

export interface ReceiptInput {
  purchaseId: string;
  locationId: string;
  receivedOn: string;
  lines: Array<{ purchaseLineId: string; quantity: string }>;
}

export interface TransferInput {
  fromLocationId: string;
  toLocationId: string;
  sentOn: string;
  lines: Array<{ itemId: string; quantity: string }>;
}

export interface ProductionInput {
  recipeId: string;
  locationId: string;
  producedOn: string;
  plannedPortions: string;
  actualPortions: string;
  note?: string;
}

export interface RecipeLineInput {
  itemId: string;
  quantity: string;
}

export interface RecipeInput {
  code: string;
  name: string;
  kind: RecipeKind;
  portions: string;
  wastagePercent: string;
  lines: RecipeLineInput[];
}

export interface CountInput {
  locationId: string;
  countedOn: string;
  note?: string;
}

export interface CountLineInput {
  itemId: string;
  counted: string;
}

export interface IssueInput {
  locationId: string;
  issuedOn: string;
  reason: StockIssueReason;
  note?: string;
  lines: Array<{ itemId: string; quantity: string }>;
}

export interface BillLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
}

export interface BillInput {
  supplierId: string;
  billNumber: string;
  billedOn: string;
  locationId: string;
  billTotal: string;
  tax: string;
  discount: string;
  lines: BillLineInput[];
}

export interface ServiceRequestInput {
  flightNumber: string;
  route: string;
  serviceDate: string;
  deliveryTime: string;
  deliveryPoint: DeliveryPoint;
  deliveryDetail?: string;
  adults: number;
  children: number;
  infants: number;
  crew: number;
  specialDiets: number;
  specialDietNote?: string;
  note?: string;
  lines: Array<{ recipeId: string; quantity: number }>;
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenStore,
  ) {}

  health(): Promise<{ status: 'ok'; service: string }> {
    return this.request('GET', '/v1/health');
  }

  login(email: string, password: string): Promise<LoginResult> {
    return this.request('POST', '/v1/auth/login', { email, password });
  }

  account(): Promise<AccountRecord> {
    return this.request('GET', '/v1/auth/me');
  }

  listAirlines(): Promise<AirlineRecord[]> {
    return this.request('GET', '/v1/airlines');
  }

  createAirline(input: AirlineInput): Promise<AirlineRecord> {
    return this.request('POST', '/v1/airlines', input);
  }

  updateAirline(id: string, input: Partial<AirlineInput>): Promise<AirlineRecord> {
    return this.request('PATCH', `/v1/airlines/${id}`, input);
  }

  createAirlineUser(airlineId: string, input: AirlineUserInput): Promise<AirlineRecord> {
    return this.request('POST', `/v1/airlines/${airlineId}/users`, input);
  }

  updateAirlineUser(
    airlineId: string,
    userId: string,
    input: AirlineUserChange,
  ): Promise<AirlineRecord> {
    return this.request('PATCH', `/v1/airlines/${airlineId}/users/${userId}`, input);
  }

  listRequests(): Promise<ServiceRequestRecord[]> {
    return this.request('GET', '/v1/requests');
  }

  listMenu(): Promise<MenuItemRecord[]> {
    return this.request('GET', '/v1/requests/menu');
  }

  createRequest(input: ServiceRequestInput): Promise<ServiceRequestRecord> {
    return this.request('POST', '/v1/requests', input);
  }

  updateRequest(id: string, input: ServiceRequestInput): Promise<ServiceRequestRecord> {
    return this.request('PATCH', `/v1/requests/${id}`, input);
  }

  submitRequest(id: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/submit`);
  }

  cancelRequest(id: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/cancel`);
  }

  acceptRequest(id: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/accept`);
  }

  rejectRequest(id: string, reason: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/reject`, { reason });
  }

  listItems(): Promise<ItemRecord[]> {
    return this.request('GET', '/v1/items');
  }

  createItem(input: ItemInput): Promise<ItemRecord> {
    return this.request('POST', '/v1/items', input);
  }

  archiveItem(id: string): Promise<ItemRecord> {
    return this.request('PATCH', `/v1/items/${id}`, { active: false });
  }

  listSuppliers(): Promise<SupplierRecord[]> {
    return this.request('GET', '/v1/suppliers');
  }

  createSupplier(input: SupplierInput): Promise<SupplierRecord> {
    return this.request('POST', '/v1/suppliers', input);
  }

  archiveSupplier(id: string): Promise<SupplierRecord> {
    return this.request('PATCH', `/v1/suppliers/${id}`, { active: false });
  }

  listLocations(): Promise<LocationRecord[]> {
    return this.request('GET', '/v1/locations');
  }

  createLocation(input: LocationInput): Promise<LocationRecord> {
    return this.request('POST', '/v1/locations', input);
  }

  archiveLocation(id: string): Promise<LocationRecord> {
    return this.request('PATCH', `/v1/locations/${id}`, { active: false });
  }

  listPurchases(): Promise<PurchaseRecord[]> {
    return this.request('GET', '/v1/purchases');
  }

  getPurchase(id: string): Promise<PurchaseRecord> {
    return this.request('GET', `/v1/purchases/${id}`);
  }

  createPurchase(input: PurchaseInput): Promise<PurchaseRecord> {
    return this.request('POST', '/v1/purchases', input);
  }

  addPurchaseLine(id: string, input: PurchaseLineInput): Promise<PurchaseRecord> {
    return this.request('POST', `/v1/purchases/${id}/lines`, input);
  }

  sendPurchase(id: string): Promise<PurchaseRecord> {
    return this.request('POST', `/v1/purchases/${id}/send`);
  }

  cancelPurchase(id: string): Promise<PurchaseRecord> {
    return this.request('POST', `/v1/purchases/${id}/cancel`);
  }

  listReceipts(): Promise<GoodsReceiptRecord[]> {
    return this.request('GET', '/v1/receipts');
  }

  createReceipt(input: ReceiptInput): Promise<GoodsReceiptRecord> {
    return this.request('POST', '/v1/receipts', input);
  }

  postBill(input: BillInput, file: Blob, fileName: string): Promise<GoodsReceiptRecord> {
    const body = new FormData();
    body.set('bill', file, fileName);
    body.set('supplierId', input.supplierId);
    body.set('billNumber', input.billNumber);
    body.set('billedOn', input.billedOn);
    body.set('locationId', input.locationId);
    body.set('billTotal', input.billTotal);
    body.set('tax', input.tax);
    body.set('discount', input.discount);
    body.set('lines', JSON.stringify(input.lines));
    return this.request('POST', '/v1/bills', body);
  }

  async billFile(receiptId: string): Promise<Blob> {
    const headers = new Headers({ Accept: 'application/pdf,image/jpeg,image/png' });
    const token = this.tokens.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${this.baseUrl}/v1/bills/${receiptId}/file`, {
      headers,
      credentials: 'include',
    });
    if (!response.ok) throw new ApiError(response.status, await readError(response));
    return response.blob();
  }

  listStock(): Promise<StockOnHandRecord[]> {
    return this.request('GET', '/v1/stock');
  }

  listIssues(): Promise<StockIssueRecord[]> {
    return this.request('GET', '/v1/stock/issues');
  }

  createIssue(input: IssueInput): Promise<StockIssueRecord> {
    return this.request('POST', '/v1/stock/issues', input);
  }

  listTransfers(): Promise<StockTransferRecord[]> {
    return this.request('GET', '/v1/stock/transfers');
  }

  createTransfer(input: TransferInput): Promise<StockTransferRecord> {
    return this.request('POST', '/v1/stock/transfers', input);
  }

  receiveTransfer(id: string, receivedOn: string): Promise<StockTransferRecord> {
    return this.request('POST', `/v1/stock/transfers/${id}/receive`, { receivedOn });
  }

  listRecipes(): Promise<RecipeRecord[]> {
    return this.request('GET', '/v1/recipes');
  }

  createRecipe(input: RecipeInput): Promise<RecipeRecord> {
    return this.request('POST', '/v1/recipes', input);
  }

  updateRecipe(id: string, input: Partial<RecipeInput> & { active?: boolean }): Promise<RecipeRecord> {
    return this.request('PATCH', `/v1/recipes/${id}`, input);
  }

  approveRecipe(id: string): Promise<RecipeRecord> {
    return this.request('POST', `/v1/recipes/${id}/approve`);
  }

  listMealCosts(): Promise<MealCostRecord[]> {
    return this.request('GET', '/v1/meal-costs');
  }

  listProduction(): Promise<ProductionRecord[]> {
    return this.request('GET', '/v1/production');
  }

  createProduction(input: ProductionInput): Promise<ProductionRecord> {
    return this.request('POST', '/v1/production', input);
  }

  listCounts(): Promise<StockCountRecord[]> {
    return this.request('GET', '/v1/stock/counts');
  }

  createCount(input: CountInput): Promise<StockCountRecord> {
    return this.request('POST', '/v1/stock/counts', input);
  }

  submitCount(id: string, lines: CountLineInput[]): Promise<StockCountRecord> {
    return this.request('POST', `/v1/stock/counts/${id}/submit`, { lines });
  }

  approveCount(id: string): Promise<StockCountRecord> {
    return this.request('POST', `/v1/stock/counts/${id}/approve`);
  }

  sendCountBack(id: string): Promise<StockCountRecord> {
    return this.request('POST', `/v1/stock/counts/${id}/send-back`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    const token = this.tokens.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: payload,
    });
    if (!response.ok) {
      throw new ApiError(response.status, await readError(response));
    }
    return (await response.json()) as T;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string | string[] };
    if (typeof payload.message === 'string') return payload.message;
    if (Array.isArray(payload.message)) return payload.message.join(' ');
  } catch {
    return `The request failed (${response.status}).`;
  }
  return `The request failed (${response.status}).`;
}
