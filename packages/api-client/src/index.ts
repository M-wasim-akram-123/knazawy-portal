import { SESSION_CLIENT_HEADER, type SessionClient } from '@knazawy/shared';
import type {
  AccountRecord,
  AirlineOption,
  DeliveryRecord,
  DisputeRecord,
  AirlineRecord,
  AirlineTermsInput,
  AirlineTermsRecord,
  AirlineRole,
  BillableRequestOption,
  DeliveryPoint,
  BranchRecord,
  ForecastRecord,
  FulfilmentRecord,
  GoodsReceiptRecord,
  InvoiceRecord,
  JournalEntryRecord,
  ItemRecord,
  LocationRecord,
  LoginResult,
  MealCostRecord,
  MenuItemRecord,
  NotificationPing,
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
  RoomAvailabilityRecord,
  PurchaseRecord,
  RecipeKind,
  RecipeRecord,
  StockCountRecord,
  StockIssueReason,
  StockIssueRecord,
  LowStockRecord,
  StockOnHandRecord,
  StockTransferRecord,
  ServiceRequestRecord,
  SupplierRecord,
  UserAccountRecord,
  Role,
} from '@knazawy/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  /** Leave out for a Karam staff account. */
  organisationId?: string;
  branchId?: string;
  password: string;
}

export interface AirlineInput {
  code: string;
  name: string;
  taxNumber?: string;
}

export interface ManualInvoiceInput {
  airlineName: string;
  taxNumber?: string;
  note?: string;
  lines: Array<{ recipeId: string; quantity: number; unitPrice: string }>;
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
  branchId: string;
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

/**
 * Typed calls to the API. The browser holds the session in an httpOnly cookie, so this client
 * never sees a token: it names its app on every request and sends cookies with it.
 */
/** A background call: it never shows the loader. */
const QUIET = { quiet: true } as const;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly client: SessionClient,
  ) {}

  private pending = 0;
  private readonly activityListeners = new Set<(pending: number) => void>();

  /**
   * Reports how many requests are waiting on the API, so the app can show its loader.
   * Background calls (the notification bell, the health check) are left out. A stable arrow
   * function, so a React effect can depend on it.
   */
  readonly onActivity = (listener: (pending: number) => void): (() => void) => {
    this.activityListeners.add(listener);
    listener(this.pending);
    return () => {
      this.activityListeners.delete(listener);
    };
  };

  private setPending(next: number): void {
    this.pending = Math.max(0, next);
    for (const listener of this.activityListeners) listener(this.pending);
  }

  /** Headers every request carries. The app name is what lets the API read the cookie. */
  private headers(accept: string): Headers {
    return new Headers({ Accept: accept, [SESSION_CLIENT_HEADER]: this.client });
  }

  health(): Promise<{ status: 'ok'; service: string }> {
    return this.request('GET', '/v1/health', undefined, QUIET);
  }

  login(email: string, password: string): Promise<LoginResult> {
    return this.request('POST', '/v1/auth/login', { email, password });
  }

  /** Clears the session cookie. Safe to call when the session has already expired. */
  async logout(): Promise<void> {
    await fetch(`${this.baseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: this.headers('application/json'),
      credentials: 'include',
    });
  }

  account(): Promise<AccountRecord> {
    return this.request('GET', '/v1/auth/me');
  }

  /** Every staff and airline account. Administrators only. */
  listUsers(): Promise<UserAccountRecord[]> {
    return this.request('GET', '/v1/users');
  }

  createUser(input: UserInput): Promise<UserAccountRecord> {
    return this.request('POST', '/v1/users', input);
  }

  updateUser(
    id: string,
    input: Partial<Omit<UserInput, 'password' | 'organisationId'>>,
  ): Promise<UserAccountRecord> {
    return this.request('PATCH', `/v1/users/${encodeURIComponent(id)}`, input);
  }

  /** Sets a new password and signs the person out everywhere. */
  setUserPassword(id: string, password: string): Promise<UserAccountRecord> {
    return this.request('POST', `/v1/users/${encodeURIComponent(id)}/password`, { password });
  }

  revokeUser(id: string): Promise<UserAccountRecord> {
    return this.request('POST', `/v1/users/${encodeURIComponent(id)}/revoke`);
  }

  restoreUser(id: string): Promise<UserAccountRecord> {
    return this.request('POST', `/v1/users/${encodeURIComponent(id)}/restore`);
  }

  deleteUser(id: string): Promise<void> {
    return this.request('DELETE', `/v1/users/${encodeURIComponent(id)}`);
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

  /** Payment days and discount. Karam staff see every airline; an airline sees its own. */
  listAirlineTerms(): Promise<AirlineTermsRecord[]> {
    return this.request('GET', '/v1/airlines/terms');
  }

  setAirlineTerms(airlineId: string, input: AirlineTermsInput): Promise<AirlineTermsRecord> {
    return this.request('PATCH', `/v1/airlines/${encodeURIComponent(airlineId)}/terms`, input);
  }

  /** Karam staff only. Whether the rooms for a stay are free, by room type. */
  roomRequestAvailability(id: string): Promise<RoomAvailabilityRecord> {
    return this.request('GET', `/v1/room-requests/${encodeURIComponent(id)}/availability`);
  }

  /** Karam staff only. Whether stock covers a request, after other accepted requests. */
  requestFulfilment(id: string): Promise<FulfilmentRecord> {
    return this.request('GET', `/v1/requests/${encodeURIComponent(id)}/fulfilment`);
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
    return this.request('GET', '/v1/notifications', undefined, QUIET);
  }

  markNotificationRead(id: string): Promise<NotificationRecord> {
    return this.request('POST', `/v1/notifications/${id}/read`, undefined, QUIET);
  }

  unreadNotificationCount(): Promise<number> {
    return this.request('GET', '/v1/notifications/unread-count', undefined, QUIET);
  }

  markAllNotificationsRead(): Promise<{ count: number; readAt: string }> {
    return this.request('POST', '/v1/notifications/read-all', undefined, QUIET);
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

  listBillableRequests(): Promise<BillableRequestOption[]> {
    return this.request('GET', '/v1/invoices/billable-requests');
  }

  createInvoice(requestId: string, note?: string): Promise<InvoiceRecord> {
    return this.request('POST', '/v1/invoices', { requestId, note });
  }

  createManualInvoice(input: ManualInvoiceInput): Promise<InvoiceRecord> {
    return this.request('POST', '/v1/invoices/manual', input);
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
    const headers = this.headers('application/pdf,image/jpeg,image/png');
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

  listLowStock(): Promise<LowStockRecord[]> {
    return this.request('GET', '/v1/stock/low');
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

  listRoomOffers(branchId: string): Promise<RoomOfferRecord[]> {
    return this.request('GET', `/v1/room-requests/offers?branchId=${encodeURIComponent(branchId)}`);
  }

  listStayBranches(): Promise<BranchRecord[]> {
    return this.request('GET', '/v1/branches/for-stays');
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

  getForecast(): Promise<ForecastRecord> {
    return this.request('GET', '/v1/forecast');
  }

  listBranches(): Promise<BranchRecord[]> {
    return this.request('GET', '/v1/branches');
  }

  listOpenBranches(): Promise<BranchRecord[]> {
    return this.request('GET', '/v1/branches/open');
  }

  createBranch(input: { code: string; name: string }): Promise<BranchRecord> {
    return this.request('POST', '/v1/branches', input);
  }

  updateBranch(id: string, input: { name?: string; active?: boolean }): Promise<BranchRecord> {
    return this.request('PATCH', `/v1/branches/${id}`, input);
  }

  useBranch(branchId: string): Promise<BranchRecord> {
    return this.request('POST', '/v1/branches/current', { branchId });
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

  /**
   * Reads the live notification stream until it ends or `signal` aborts. Uses fetch rather than
   * EventSource so the app header goes with it.
   */
  async readNotificationStream(
    onPing: (ping: NotificationPing) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const headers = this.headers('text/event-stream');
    const response = await fetch(`${this.baseUrl}/v1/notifications/stream`, {
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!response.ok || !response.body) {
      throw new ApiError(response.status, `The live stream failed (${response.status}).`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let end = buffer.indexOf('\n\n');
      while (end !== -1) {
        const ping = parseServerEvent(buffer.slice(0, end));
        if (ping) onPing(ping);
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf('\n\n');
      }
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { quiet?: boolean } = {},
  ): Promise<T> {
    if (options.quiet) return this.send<T>(method, path, body);
    this.setPending(this.pending + 1);
    try {
      return await this.send<T>(method, path, body);
    } finally {
      this.setPending(this.pending - 1);
    }
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers = this.headers('application/json');
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
    if (response.status === 204) return undefined as T;
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

/** A `notification` event's data, or null for comments and other events. */
export function parseServerEvent(block: string): NotificationPing | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (event !== 'notification' || data.length === 0) return null;
  try {
    const parsed = JSON.parse(data.join('\n')) as Partial<NotificationPing>;
    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') return null;
    return {
      title: parsed.title,
      body: parsed.body,
      entity: typeof parsed.entity === 'string' ? parsed.entity : '',
      entityId: typeof parsed.entityId === 'string' ? parsed.entityId : '',
    };
  } catch {
    return null;
  }
}

/**
 * Keeps a live notification stream open, reconnecting with a growing pause after a drop.
 * Stops for good on a 401, which means the session has ended. Returns the stop function.
 */
export function watchNotifications(
  client: ApiClient,
  handlers: { onPing: (ping: NotificationPing) => void; onSignedOut?: () => void },
): () => void {
  const controller = new AbortController();
  let pause = 2_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    void client
      .readNotificationStream((ping) => {
        pause = 2_000;
        handlers.onPing(ping);
      }, controller.signal)
      .then(
        () => schedule(),
        (caught: unknown) => {
          if (controller.signal.aborted) return;
          if (caught instanceof ApiError && caught.status === 401) {
            handlers.onSignedOut?.();
            return;
          }
          schedule();
        },
      );
  };
  const schedule = () => {
    if (controller.signal.aborted) return;
    timer = setTimeout(connect, pause);
    pause = Math.min(pause * 2, 30_000);
  };

  connect();
  return () => {
    controller.abort();
    if (timer) clearTimeout(timer);
  };
}
