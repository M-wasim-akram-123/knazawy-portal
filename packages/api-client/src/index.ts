import type { TokenStore } from '@knazawy/auth-client';
import type {
  AccountRecord,
  AirlineOption,
  DeliveryRecord,
  DisputeRecord,
  AirlineRecord,
  AirlineRole,
  DeliveryPoint,
  GoodsReceiptRecord,
  InvoiceRecord,
  JournalEntryRecord,
  ItemRecord,
  LocationRecord,
  LoginResult,
  MealCostRecord,
  MenuItemRecord,
  NotificationRecord,
  ProductionRecord,
  RateCardRecord,
  RoomFloorRecord,
  RoomTypeRecord,
  HotelRoomRecord,
  FreeRoomRecord,
  RoomOfferRecord,
  RoomBillableRecord,
  RoomInvoiceRecord,
  RoomRequestRecord,
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

export interface RoomRequestInput {
  checkIn: string;
  checkOut: string;
  party?: string;
  note?: string;
  lines: Array<{ roomTypeId: string; rooms: number }>;
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

export interface RateCardInput {
  airlineId: string;
  validFrom: string;
  validTo?: string;
  note?: string;
  lines: Array<{ recipeId: string; unitPrice: string; minimumQuantity: number }>;
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

  amendRequest(
    id: string,
    input: ServiceRequestInput & { reason: string },
  ): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/amend`, input);
  }

  cancelRequest(id: string, input: { acceptCharge?: boolean } = {}): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/cancel`, input);
  }

  listNotifications(): Promise<NotificationRecord[]> {
    return this.request('GET', '/v1/notifications');
  }

  markNotificationRead(id: string): Promise<NotificationRecord> {
    return this.request('POST', `/v1/notifications/${id}/read`);
  }

  listDisputes(): Promise<DisputeRecord[]> {
    return this.request('GET', '/v1/disputes');
  }

  openDispute(invoiceId: string, reason: string): Promise<DisputeRecord> {
    return this.request('POST', '/v1/disputes', { invoiceId, reason });
  }

  openRoomDispute(roomInvoiceId: string, reason: string): Promise<DisputeRecord> {
    return this.request('POST', '/v1/disputes', { roomInvoiceId, reason });
  }

  acceptDispute(id: string, resolution: string): Promise<DisputeRecord> {
    return this.request('POST', `/v1/disputes/${id}/accept`, { resolution });
  }

  rejectDispute(id: string, resolution: string): Promise<DisputeRecord> {
    return this.request('POST', `/v1/disputes/${id}/reject`, { resolution });
  }

  acceptRequest(id: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/accept`);
  }

  rejectRequest(id: string, reason: string): Promise<ServiceRequestRecord> {
    return this.request('POST', `/v1/requests/${id}/reject`, { reason });
  }

  listJournal(): Promise<JournalEntryRecord[]> {
    return this.request('GET', '/v1/ledger');
  }

  journalCsv(): Promise<{ csv: string }> {
    return this.request('GET', '/v1/ledger/export');
  }

  listInvoices(): Promise<InvoiceRecord[]> {
    return this.request('GET', '/v1/invoices');
  }

  createInvoice(requestId: string, note?: string): Promise<InvoiceRecord> {
    return this.request('POST', '/v1/invoices', { requestId, note });
  }

  issueInvoice(id: string): Promise<InvoiceRecord> {
    return this.request('POST', `/v1/invoices/${id}/issue`);
  }

  creditInvoice(
    id: string,
    input: { reason: string; lines: Array<{ recipeId: string; quantity: number }> },
  ): Promise<InvoiceRecord> {
    return this.request('POST', `/v1/invoices/${id}/credit`, input);
  }

  listDeliveries(): Promise<DeliveryRecord[]> {
    return this.request('GET', '/v1/deliveries');
  }

  startDelivery(requestId: string): Promise<DeliveryRecord> {
    return this.request('POST', '/v1/deliveries', { requestId });
  }

  dispatchDelivery(
    id: string,
    input: { vehicleNote?: string; lines: Array<{ recipeId: string; quantity: number }> },
  ): Promise<DeliveryRecord> {
    return this.request('POST', `/v1/deliveries/${id}/dispatch`, input);
  }

  recordDelivery(
    id: string,
    input: {
      receivedBy?: string;
      note?: string;
      lines: Array<{ recipeId: string; quantity: number }>;
    },
  ): Promise<DeliveryRecord> {
    return this.request('POST', `/v1/deliveries/${id}/deliver`, input);
  }

  listRateCardAirlines(): Promise<AirlineOption[]> {
    return this.request('GET', '/v1/rate-cards/airlines');
  }

  listRateCards(airlineId?: string): Promise<RateCardRecord[]> {
    const query = airlineId ? `?airlineId=${encodeURIComponent(airlineId)}` : '';
    return this.request('GET', `/v1/rate-cards${query}`);
  }

  async currentRateCard(serviceDate: string, airlineId?: string): Promise<RateCardRecord | null> {
    const query = new URLSearchParams({ serviceDate });
    if (airlineId) query.set('airlineId', airlineId);
    const result = await this.request<{ card: RateCardRecord | null }>(
      'GET',
      `/v1/rate-cards/current?${query.toString()}`,
    );
    return result.card;
  }

  createRateCard(input: RateCardInput): Promise<RateCardRecord> {
    return this.request('POST', '/v1/rate-cards', input);
  }

  updateRateCard(id: string, input: RateCardInput): Promise<RateCardRecord> {
    return this.request('PATCH', `/v1/rate-cards/${id}`, input);
  }

  approveRateCard(id: string): Promise<RateCardRecord> {
    return this.request('POST', `/v1/rate-cards/${id}/approve`);
  }

  endRateCard(id: string, validTo: string): Promise<RateCardRecord> {
    return this.request('POST', `/v1/rate-cards/${id}/end`, { validTo });
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

  listRoomFloors(): Promise<RoomFloorRecord[]> {
    return this.request('GET', '/v1/room-floors');
  }

  createRoomFloor(input: { name: string; sortOrder?: number }): Promise<RoomFloorRecord> {
    return this.request('POST', '/v1/room-floors', input);
  }

  updateRoomFloor(
    id: string,
    input: { name?: string; sortOrder?: number; active?: boolean },
  ): Promise<RoomFloorRecord> {
    return this.request('PATCH', `/v1/room-floors/${id}`, input);
  }

  listRoomTypes(): Promise<RoomTypeRecord[]> {
    return this.request('GET', '/v1/room-types');
  }

  createRoomType(input: { name: string; note?: string }): Promise<RoomTypeRecord> {
    return this.request('POST', '/v1/room-types', input);
  }

  updateRoomType(
    id: string,
    input: { name?: string; note?: string; active?: boolean },
  ): Promise<RoomTypeRecord> {
    return this.request('PATCH', `/v1/room-types/${id}`, input);
  }

  addRoomCharge(
    typeId: string,
    input: { name: string; amountPerNight: string },
  ): Promise<RoomTypeRecord> {
    return this.request('POST', `/v1/room-types/${typeId}/charges`, input);
  }

  updateRoomCharge(
    typeId: string,
    chargeId: string,
    input: { name?: string; amountPerNight?: string; active?: boolean },
  ): Promise<RoomTypeRecord> {
    return this.request('PATCH', `/v1/room-types/${typeId}/charges/${chargeId}`, input);
  }

  listHotelRooms(): Promise<HotelRoomRecord[]> {
    return this.request('GET', '/v1/hotel-rooms');
  }

  createHotelRoom(input: {
    floorId: string;
    roomTypeId: string;
    name: string;
  }): Promise<HotelRoomRecord> {
    return this.request('POST', '/v1/hotel-rooms', input);
  }

  updateHotelRoom(
    id: string,
    input: { floorId?: string; roomTypeId?: string; name?: string; active?: boolean },
  ): Promise<HotelRoomRecord> {
    return this.request('PATCH', `/v1/hotel-rooms/${id}`, input);
  }

  listRoomRequests(): Promise<RoomRequestRecord[]> {
    return this.request('GET', '/v1/room-requests');
  }

  listRoomOffers(): Promise<RoomOfferRecord[]> {
    return this.request('GET', '/v1/room-requests/offers');
  }

  createRoomRequest(input: RoomRequestInput): Promise<RoomRequestRecord> {
    return this.request('POST', '/v1/room-requests', input);
  }

  updateRoomRequest(id: string, input: RoomRequestInput): Promise<RoomRequestRecord> {
    return this.request('PATCH', `/v1/room-requests/${id}`, input);
  }

  submitRoomRequest(id: string): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${id}/submit`);
  }

  cancelRoomRequest(id: string): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${id}/cancel`);
  }

  acceptRoomRequest(id: string): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${id}/accept`);
  }

  rejectRoomRequest(id: string, reason: string): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${id}/reject`, { reason });
  }

  freeRoomsForRequest(id: string): Promise<FreeRoomRecord[]> {
    return this.request('GET', `/v1/room-requests/${id}/free-rooms`);
  }

  checkInRoomRequest(id: string, hotelRoomIds: string[]): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${id}/check-in`, { hotelRoomIds });
  }

  checkOutRoomStay(requestId: string, stayId: string): Promise<RoomRequestRecord> {
    return this.request('POST', `/v1/room-requests/${requestId}/stays/${stayId}/check-out`);
  }

  listRoomBillable(): Promise<RoomBillableRecord[]> {
    return this.request('GET', '/v1/room-invoices/billable');
  }

  listRoomInvoices(): Promise<RoomInvoiceRecord[]> {
    return this.request('GET', '/v1/room-invoices');
  }

  raiseRoomInvoice(roomRequestId: string): Promise<RoomInvoiceRecord> {
    return this.request('POST', '/v1/room-invoices', { roomRequestId });
  }

  creditRoomInvoice(id: string, reason: string): Promise<RoomInvoiceRecord> {
    return this.request('POST', `/v1/room-invoices/${id}/credit`, { reason });
  }

  listRecipes(): Promise<RecipeRecord[]> {
    return this.request('GET', '/v1/recipes');
  }

  createRecipe(input: RecipeInput): Promise<RecipeRecord> {
    return this.request('POST', '/v1/recipes', input);
  }

  updateRecipe(
    id: string,
    input: Partial<RecipeInput> & { active?: boolean },
  ): Promise<RecipeRecord> {
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
