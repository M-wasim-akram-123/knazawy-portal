import { isAirlineRole } from './airlines';
import { moneyMatches, supplierBillOwed } from './bills';
import { costDifference, costOnePortion } from './costing';
import { formatDisplayDate, formatKarachiDateTime, todayInKarachi } from './dates';
import {
  canDecideDispute,
  canDisputeInvoice,
  canDisputeRoomInvoice,
  canOpenDispute,
  nextDisputeStatus,
} from './disputes';
import {
  deliveredQuantityError,
  dispatchQuantityError,
  requestStatusAfterDelivery,
} from './distribution';
import {
  amountDue,
  canIssueInvoice,
  canRaiseInvoice,
  creditQuantityError,
  priceInvoiceLines,
  requestStatusAfterInvoice,
} from './invoices';
import { creditNotePosting, invoicePosting, journalBalanceError, journalCsv } from './ledger';
import {
  billedQuantity,
  chargeFor,
  previewCharges,
  rateCardCovers,
  rateCardsOverlap,
} from './rates';
import { can, canReadOrganisation } from './rbac';
import { recipeIngredientQuantity, recipeStockYield } from './recipes';
import {
  amendmentError,
  cancellationChargeApplies,
  cutOffInstant,
  isPastCutOff,
  isRequestEditable,
  nextRequestStatus,
  passengerTotal,
} from './requests';
import { canRaiseRoomInvoice, roomBillError, roomCreditError } from './room-billing';
import {
  canDecideRoomRequest,
  canRequestRooms,
  isRoomRequestEditable,
  nextRoomRequestStatus,
  chargeAmountError,
  nightlyChargeTotal,
  canManageRoomStays,
  roomAvailabilityError,
  roomLineError,
  peakRoomsNeeded,
  roomNights,
  roomRemovalError,
  roomStayWindowError,
  roomStockError,
  roomsStillFree,
  roomsToCheckIn,
  setupNameError,
  stayLineAmount,
  stayTotal,
  staysOverlap,
} from './rooms';
import { purchaseStatusTone, statusTone } from './status';
import { countStatusTone } from './stock';

describe('permissions', () => {
  it('lets the storekeeper create a purchase and blocks the airline requester', () => {
    expect(can('STOREKEEPER', 'purchases', 'C')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'purchases', 'C')).toBe(false);
  });

  it('lets the administrator create master data and keeps the kitchen off suppliers', () => {
    expect(can('ADMINISTRATOR', 'stock', 'C')).toBe(true);
    expect(can('ADMINISTRATOR', 'stock', 'A')).toBe(true);
    expect(can('ADMINISTRATOR', 'recipes', 'C')).toBe(true);
    expect(can('ADMINISTRATOR', 'recipes', 'A')).toBe(true);
    expect(can('KITCHEN_LEAD', 'recipes', 'C')).toBe(true);
    expect(can('KITCHEN_LEAD', 'recipes', 'A')).toBe(false);
    expect(can('STOREKEEPER', 'recipes', 'R')).toBe(false);
    expect(can('OPERATIONS_MANAGER', 'stock', 'A')).toBe(true);
    expect(can('STOREKEEPER', 'stock', 'A')).toBe(false);
    expect(can('KITCHEN_LEAD', 'purchases', 'R')).toBe(false);
    expect(can('KITCHEN_LEAD', 'stock', 'R')).toBe(true);
    expect(can('FINANCE_OFFICER', 'recipes', 'R')).toBe(true);
    expect(can('FINANCE_OFFICER', 'recipes', 'C')).toBe(false);
    expect(can('ADMINISTRATOR', 'users', 'C')).toBe(true);
    expect(can('OPERATIONS_MANAGER', 'users', 'R')).toBe(false);
    expect(can('AIRLINE_REQUESTER', 'users', 'R')).toBe(false);
    expect(can('HOTEL_COORDINATOR', 'service_requests', 'R')).toBe(false);
    expect(can('HOTEL_COORDINATOR', 'invoices', 'R')).toBe(false);
    expect(isAirlineRole('AIRLINE_FINANCE')).toBe(true);
    expect(isAirlineRole('STOREKEEPER')).toBe(false);
  });

  it('lets Karam staff read another organisation and keeps airlines on their own', () => {
    const airline = { role: 'AIRLINE_REQUESTER' as const, organisationId: 'pia' };
    expect(canReadOrganisation(airline, 'pia')).toBe(true);
    expect(canReadOrganisation(airline, 'serene')).toBe(false);
    expect(
      canReadOrganisation({ role: 'OPERATIONS_MANAGER', organisationId: 'karam' }, 'pia'),
    ).toBe(true);
  });
});

describe('purchasing dates and status', () => {
  it('shows dates as DD/MM/YYYY and colours a received purchase as done', () => {
    expect(formatDisplayDate('2026-11-13')).toBe('13/11/2026');
    expect(todayInKarachi(new Date('2026-11-13T20:30:00.000Z'))).toBe('2026-11-14');
    expect(purchaseStatusTone('RECEIVED')).toBe('done');
    expect(purchaseStatusTone('SENT')).toBe('progress');
    expect(purchaseStatusTone('CANCELLED')).toBe('problem');
  });
});

describe('supplier bills', () => {
  it('adds the lines and tax, then takes off the discount', () => {
    expect(
      supplierBillOwed({
        lines: [{ quantity: '4', unitPrice: '5000' }],
        tax: '0',
        discount: '0',
      }),
    ).toEqual({ ok: true, lines: '20000.00', owed: '20000.00' });
    expect(
      supplierBillOwed({
        lines: [{ quantity: '1.5', unitPrice: '10.33' }],
        tax: '1.50',
        discount: '0.25',
      }),
    ).toEqual({ ok: true, lines: '15.50', owed: '16.75' });
    expect(moneyMatches('16.75', '16.750')).toBe(false);
    expect(moneyMatches('20000', '20000.00')).toBe(true);
  });

  it('rejects a discount larger than the bill', () => {
    expect(
      supplierBillOwed({
        lines: [{ quantity: '1', unitPrice: '10' }],
        tax: '0',
        discount: '10.01',
      }),
    ).toEqual({ ok: false, reason: 'discount' });
  });
});

describe('recipe quantities', () => {
  it('adds the wastage onto one batch of portions', () => {
    expect(
      recipeIngredientQuantity({
        quantityPerPortion: '0.15',
        portions: '10',
        wastagePercent: '5',
      }),
    ).toEqual({ ok: true, perPortion: '0.15', batch: '1.575' });
    expect(
      recipeIngredientQuantity({
        quantityPerPortion: '0.15',
        portions: '10',
        wastagePercent: '0',
      }),
    ).toEqual({ ok: true, perPortion: '0.15', batch: '1.5' });
  });

  it('rejects a wastage percent above 100', () => {
    expect(
      recipeIngredientQuantity({
        quantityPerPortion: '1',
        portions: '1',
        wastagePercent: '100.01',
      }),
    ).toEqual({ ok: false, reason: 'wastage' });
  });

  it('estimates whole portions from the limiting ingredient and wastage', () => {
    expect(
      recipeStockYield({
        wastagePercent: '10',
        lines: [
          { itemName: 'Rice', quantityPerPortion: '0.15', available: '1.65' },
          { itemName: 'Chicken', quantityPerPortion: '0.2', available: '0.99' },
        ],
      }),
    ).toEqual({ ok: true, portions: '4', limitingIngredients: ['Chicken'] });
  });

  it('does not round sub-mill quantities of stock up', () => {
    expect(
      recipeStockYield({
        wastagePercent: '0',
        lines: [{ itemName: 'Flour', quantityPerPortion: '0.001', available: '0.0009' }],
      }),
    ).toEqual({ ok: true, portions: '0', limitingIngredients: ['Flour'] });
  });
});

describe('meal cost', () => {
  it('prices one portion from the latest unit cost, with wastage', () => {
    expect(
      costOnePortion({
        wastagePercent: '10',
        lines: [{ quantityPerPortion: '0.15', unitCost: '200' }],
      }),
    ).toEqual({
      lines: [{ quantityWithWastage: '0.165', lineCost: '33' }],
      standardCost: '33',
    });
    expect(
      costOnePortion({
        wastagePercent: '0',
        lines: [{ quantityPerPortion: '0.15', unitCost: '200.5' }],
      }).standardCost,
    ).toBe('30.08');
  });

  it('leaves the standard cost open when an ingredient has no price', () => {
    const cost = costOnePortion({
      wastagePercent: '0',
      lines: [
        { quantityPerPortion: '1', unitCost: '10' },
        { quantityPerPortion: '1', unitCost: null },
      ],
    });
    expect(cost.standardCost).toBeNull();
    expect(cost.lines[0]?.lineCost).toBe('10');
    expect(cost.lines[1]?.lineCost).toBeNull();
  });

  it('shows how far the cooked cost sits from the standard', () => {
    expect(costDifference('33', '30.08')).toBe('2.92');
    expect(costDifference('30', '33')).toBe('-3');
    expect(costDifference('33', '33')).toBe('0');
  });
});

describe('deliveries', () => {
  it('moves an accepted request through production, dispatch, and delivery', () => {
    expect(requestStatusAfterDelivery('ACCEPTED', 'start')).toBe('IN_PRODUCTION');
    expect(requestStatusAfterDelivery('IN_PRODUCTION', 'dispatch')).toBe('DISPATCHED');
    expect(requestStatusAfterDelivery('DISPATCHED', 'deliver')).toBe('DELIVERED');
    expect(requestStatusAfterDelivery('SUBMITTED', 'start')).toBeNull();
    expect(requestStatusAfterDelivery('DELIVERED', 'deliver')).toBeNull();
  });

  it('sends no more than ordered, and records no more than was sent', () => {
    expect(dispatchQuantityError([{ ordered: 10, quantity: 11 }])).toBe(
      'Send no more than was ordered.',
    );
    expect(dispatchQuantityError([{ ordered: 10, quantity: 0 }])).toBe(
      'Send at least one portion.',
    );
    expect(dispatchQuantityError([{ ordered: 10, quantity: 10 }])).toBeNull();
    expect(deliveredQuantityError([{ dispatched: 8, quantity: 9 }])).toBe(
      'Record no more than was sent.',
    );
    expect(deliveredQuantityError([{ dispatched: 8, quantity: 0 }])).toBeNull();
  });
});

describe('ledger', () => {
  it('posts an invoice as money owed and a sale, and a credit note the other way', () => {
    expect(journalBalanceError(invoicePosting('13000.00'))).toBeNull();
    expect(invoicePosting('13000.00')[0]).toEqual({
      account: '1100',
      side: 'DEBIT',
      amount: '13000.00',
    });
    expect(creditNotePosting('1300.00').map((line) => line.side)).toEqual(['DEBIT', 'CREDIT']);
    expect(journalBalanceError(creditNotePosting('1300.00'))).toBeNull();
  });

  it('refuses an entry that does not balance, and an empty one', () => {
    expect(
      journalBalanceError([
        { account: '1100', side: 'DEBIT', amount: '10.00' },
        { account: '4000', side: 'CREDIT', amount: '9.00' },
      ]),
    ).toBe('The entry does not balance.');
    expect(journalBalanceError(invoicePosting('0.00'))).toBe('There is nothing to post.');
  });

  it('writes a spreadsheet row for each side', () => {
    const csv = journalCsv([
      {
        id: 'je-1',
        number: 'JE-00001',
        airlineId: 'air-1',
        airlineName: 'Sample Air',
        memo: 'Invoice IN-00001',
        postedAt: '2026-11-14T07:00:00.000Z',
        total: '13000.00',
        lines: invoicePosting('13000.00').map((line) => ({
          ...line,
          accountName: line.account === '1100' ? 'Accounts receivable' : 'Meal sales',
        })),
      },
    ]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('14/11/2026,JE-00001,Sample Air,Accounts receivable,Debit,13000.00');
  });
});

describe('invoices', () => {
  it('bills the delivered portions, and at least the minimum', () => {
    const priced = priceInvoiceLines([
      {
        recipeId: 'biryani',
        recipeName: 'Chicken biryani',
        kind: 'MEAL',
        deliveredQuantity: 8,
        minimumQuantity: 20,
        unitPrice: '650',
      },
    ]);
    expect(priced?.lines[0]?.billedQuantity).toBe(20);
    expect(priced?.total).toBe('13000.00');
  });

  it('keeps a credit inside what was billed and reduces the amount due', () => {
    expect(creditQuantityError(20, 0, 21)).toBe('Credit no more than was billed.');
    expect(creditQuantityError(20, 18, 2)).toBeNull();
    expect(amountDue('13000.00', ['1300.00'])).toBe('11700.00');
    expect(amountDue('13000.00', ['13000.00', '0.01'])).toBeNull();
  });

  it('lets Karam finance raise and issue a bill, and an airline only read it', () => {
    expect(canRaiseInvoice('FINANCE_OFFICER')).toBe(true);
    expect(canIssueInvoice('FINANCE_OFFICER')).toBe(true);
    expect(canRaiseInvoice('AIRLINE_FINANCE')).toBe(false);
    expect(canRaiseInvoice('OPERATIONS_MANAGER')).toBe(false);
    expect(requestStatusAfterInvoice('DELIVERED')).toBe('INVOICED');
    expect(requestStatusAfterInvoice('DISPATCHED')).toBeNull();
  });
});

describe('rate cards', () => {
  it('uses the card whose dates include the service date', () => {
    const card = { validFrom: '2026-12-01', validTo: '2026-12-31' };
    expect(rateCardCovers(card, '2026-12-01')).toBe(true);
    expect(rateCardCovers(card, '2026-12-31')).toBe(true);
    expect(rateCardCovers(card, '2027-01-01')).toBe(false);
    expect(rateCardCovers({ validFrom: '2026-12-01', validTo: null }, '2030-06-01')).toBe(true);
  });

  it('spots overlapping periods, including open-ended cards', () => {
    const december = { validFrom: '2026-12-01', validTo: '2026-12-31' };
    expect(rateCardsOverlap(december, { validFrom: '2027-01-01', validTo: null })).toBe(false);
    expect(rateCardsOverlap(december, { validFrom: '2026-12-31', validTo: null })).toBe(true);
    expect(rateCardsOverlap({ validFrom: '2026-01-01', validTo: null }, december)).toBe(true);
  });

  it('bills at least the minimum and prices in paisa', () => {
    expect(billedQuantity(8, 10)).toBe(10);
    expect(billedQuantity(140, 10)).toBe(140);
    expect(chargeFor(3, '450.50')).toBe('1351.50');
    expect(chargeFor(3, '12.345')).toBeNull();
  });

  it('previews a request total, or none when an item has no price', () => {
    const card = {
      lines: [
        {
          recipeId: 'biryani',
          recipeName: 'Chicken biryani',
          kind: 'MEAL' as const,
          unitPrice: '650',
          minimumQuantity: 20,
        },
      ],
    };
    const priced = previewCharges([{ recipeId: 'biryani', quantity: 10 }], card);
    expect(priced.lines[0]?.billedQuantity).toBe(20);
    expect(priced.total).toBe('13000.00');
    expect(previewCharges([{ recipeId: 'samosa', quantity: 5 }], card).total).toBeNull();
    expect(previewCharges([{ recipeId: 'biryani', quantity: 5 }], null).total).toBeNull();
  });
});

describe('service requests', () => {
  it('moves a draft to submitted, and only the airline may cancel it', () => {
    expect(nextRequestStatus('DRAFT', 'submit')).toBe('SUBMITTED');
    expect(nextRequestStatus('DRAFT', 'cancel')).toBe('CANCELLED');
    expect(nextRequestStatus('DRAFT', 'accept')).toBeNull();
    expect(isRequestEditable('DRAFT')).toBe(true);
  });

  it('lets Karam accept or reject only a submitted request', () => {
    expect(nextRequestStatus('SUBMITTED', 'accept')).toBe('ACCEPTED');
    expect(nextRequestStatus('SUBMITTED', 'reject')).toBe('REJECTED');
    expect(nextRequestStatus('REJECTED', 'accept')).toBeNull();
    expect(nextRequestStatus('IN_PRODUCTION', 'cancel')).toBeNull();
    expect(isRequestEditable('SUBMITTED')).toBe(false);
  });

  it('counts passengers once, with special diets inside the total', () => {
    expect(
      passengerTotal({ adults: 120, children: 10, infants: 2, crew: 8, specialDiets: 5 }),
    ).toBe(140);
  });

  it('keeps the airline on its own requests and the kitchen read-only', () => {
    expect(can('AIRLINE_REQUESTER', 'service_requests', 'C')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'service_requests', 'U')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'service_requests', 'A')).toBe(false);
    expect(can('AIRLINE_FINANCE', 'service_requests', 'R')).toBe(false);
    expect(can('OPERATIONS_MANAGER', 'service_requests', 'A')).toBe(true);
    expect(can('OPERATIONS_MANAGER', 'service_requests', 'C')).toBe(false);
    expect(can('ADMINISTRATOR', 'service_requests', 'A')).toBe(false);
    expect(can('KITCHEN_LEAD', 'service_requests', 'R')).toBe(true);
    expect(can('KITCHEN_LEAD', 'service_requests', 'A')).toBe(false);
  });
});

describe('cut-off and amendments', () => {
  it('closes the airline window 24 hours before delivery in Karachi', () => {
    const cutOff = cutOffInstant('2026-12-15', '11:30');
    expect(cutOff?.toISOString()).toBe('2026-12-14T06:30:00.000Z');
    expect(formatKarachiDateTime(cutOff ?? new Date(0))).toBe('14/12/2026 11:30');
    expect(isPastCutOff('2026-12-15', '11:30', new Date('2026-12-14T06:29:00.000Z'))).toBe(false);
    expect(isPastCutOff('2026-12-15', '11:30', new Date('2026-12-14T06:30:00.000Z'))).toBe(true);
  });

  it('lets an airline change a sent request only before the cut-off', () => {
    expect(amendmentError('SUBMITTED', false, false)).toBeNull();
    expect(amendmentError('ACCEPTED', true, false)).toBe(
      'The cut-off has passed. Ask Karam to change this request.',
    );
    expect(amendmentError('ACCEPTED', true, true)).toBeNull();
    expect(amendmentError('IN_PRODUCTION', false, true)).toBe(
      'This request can no longer be changed.',
    );
  });

  it('charges a cancellation only after an accepted request passes the cut-off', () => {
    expect(nextRequestStatus('ACCEPTED', 'cancel')).toBe('CANCELLED');
    expect(nextRequestStatus('SUBMITTED', 'cancel')).toBe('CANCELLED');
    expect(cancellationChargeApplies('SUBMITTED', true)).toBe(false);
    expect(cancellationChargeApplies('ACCEPTED', false)).toBe(false);
    expect(cancellationChargeApplies('ACCEPTED', true)).toBe(true);
  });
});

describe('disputes', () => {
  it('lets airline finance open a dispute and Karam finance decide it', () => {
    expect(canOpenDispute('AIRLINE_FINANCE')).toBe(true);
    expect(canOpenDispute('AIRLINE_REQUESTER')).toBe(false);
    expect(canOpenDispute('FINANCE_OFFICER')).toBe(false);
    expect(canDecideDispute('FINANCE_OFFICER')).toBe(true);
    expect(canDecideDispute('ADMINISTRATOR')).toBe(false);
    expect(canDecideDispute('OPERATIONS_MANAGER')).toBe(false);
    expect(nextDisputeStatus('OPEN', 'accept')).toBe('ACCEPTED');
    expect(nextDisputeStatus('OPEN', 'reject')).toBe('REJECTED');
    expect(nextDisputeStatus('ACCEPTED', 'reject')).toBeNull();
    expect(canDisputeInvoice('INVOICE', 'ISSUED')).toBe(true);
    expect(canDisputeInvoice('CANCELLATION', 'ISSUED')).toBe(true);
    expect(canDisputeInvoice('CREDIT_NOTE', 'ISSUED')).toBe(false);
    expect(canDisputeInvoice('INVOICE', 'DRAFT')).toBe(false);
    expect(canDisputeRoomInvoice('INVOICE')).toBe(true);
    expect(canDisputeRoomInvoice('CREDIT_NOTE')).toBe(false);
  });
});

describe('room requests', () => {
  it('counts a stay in nights, and refuses a stay that ends before it starts', () => {
    expect(roomNights('2026-12-20', '2026-12-22')).toBe(2);
    expect(roomNights('2026-12-31', '2027-01-01')).toBe(1);
    expect(roomNights('2026-12-20', '2026-12-20')).toBeNull();
    expect(roomNights('2026-12-22', '2026-12-20')).toBeNull();
    expect(roomNights('2026-02-30', '2026-03-01')).toBeNull();
  });

  it('moves a room request like a service request, and only the airline sends it', () => {
    expect(nextRoomRequestStatus('DRAFT', 'submit')).toBe('SUBMITTED');
    expect(nextRoomRequestStatus('SUBMITTED', 'accept')).toBe('ACCEPTED');
    expect(nextRoomRequestStatus('SUBMITTED', 'reject')).toBe('REJECTED');
    expect(nextRoomRequestStatus('ACCEPTED', 'cancel')).toBeNull();
    expect(isRoomRequestEditable('SUBMITTED')).toBe(false);
    expect(canRequestRooms('AIRLINE_REQUESTER')).toBe(true);
    expect(canRequestRooms('OPERATIONS_MANAGER')).toBe(false);
    expect(canDecideRoomRequest('OPERATIONS_MANAGER')).toBe(true);
    expect(canDecideRoomRequest('FINANCE_OFFICER')).toBe(false);
    expect(canDecideRoomRequest('AIRLINE_REQUESTER')).toBe(false);
  });

  it('prices a night from the charges an administrator has set', () => {
    expect(
      nightlyChargeTotal([
        { amountPerNight: '8000', active: true },
        { amountPerNight: '500.50', active: true },
        { amountPerNight: '200', active: false },
      ]),
    ).toBe('8500.50');
    expect(nightlyChargeTotal([])).toBe('0.00');
    expect(nightlyChargeTotal([{ amountPerNight: 'free', active: true }])).toBeNull();
    expect(chargeAmountError('8000.50')).toBeNull();
    expect(chargeAmountError('eight thousand')).toMatch(/PKR/);
    expect(setupNameError('  ', 'floor')).toBe('Enter a floor.');
    expect(setupNameError('Ground', 'floor')).toBeNull();
  });

  it('lets an administrator set up rooms and keeps operations to reading them', () => {
    expect(can('ADMINISTRATOR', 'rooms', 'C')).toBe(true);
    expect(can('ADMINISTRATOR', 'rooms', 'U')).toBe(true);
    expect(can('OPERATIONS_MANAGER', 'rooms', 'R')).toBe(true);
    expect(can('OPERATIONS_MANAGER', 'rooms', 'C')).toBe(false);
    expect(can('FINANCE_OFFICER', 'rooms', 'R')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'rooms', 'R')).toBe(false);
  });

  it('keeps a checkout morning free, and prices the stay from the nightly charges', () => {
    expect(staysOverlap('2026-12-20', '2026-12-22', '2026-12-22', '2026-12-23')).toBe(false);
    expect(staysOverlap('2026-12-20', '2026-12-22', '2026-12-21', '2026-12-23')).toBe(true);
    expect(roomsStillFree(3, 1)).toBe(2);
    expect(roomStockError('Single', 1, 2)).toBe('Karam has only 1 Single room.');
    expect(roomAvailabilityError('Single', 0, 1)).toBe(
      'No Single rooms are free for those nights.',
    );
    expect(stayLineAmount(1, 2, '8500.00')).toBe('17000.00');
    expect(
      stayTotal(
        [
          { rooms: 1, nightly: '8000.00' },
          { rooms: 1, nightly: '500.00' },
        ],
        2,
      ),
    ).toBe('17000.00');
  });

  it('checks guests in from the first night until the morning the stay ends', () => {
    expect(roomStayWindowError('2026-12-19', '2026-12-20', '2026-12-22')).toBe(
      'Check-in opens on the first night of the stay.',
    );
    expect(roomStayWindowError('2026-12-20', '2026-12-20', '2026-12-22')).toBeNull();
    expect(roomStayWindowError('2026-12-21', '2026-12-20', '2026-12-22')).toBeNull();
    expect(roomStayWindowError('2026-12-22', '2026-12-20', '2026-12-22')).toBe(
      'This stay has ended.',
    );
    expect(roomsToCheckIn(2, 1)).toBe(1);
    expect(roomsToCheckIn(1, 3)).toBe(0);
    expect(canManageRoomStays('OPERATIONS_MANAGER')).toBe(true);
    expect(canManageRoomStays('ADMINISTRATOR')).toBe(false);
    expect(canManageRoomStays('AIRLINE_REQUESTER')).toBe(false);
  });

  it('asks for at least one room and at least one night', () => {
    expect(roomLineError(0, 2)).toBe('Ask for at least one room.');
    expect(roomLineError(100, 2)).toBe('Ask for no more than 99 rooms.');
    expect(roomLineError(2, 0)).toBe('A stay is at least one night.');
    expect(roomLineError(2, 3)).toBeNull();
  });
});

describe('room removal', () => {
  const stays = [
    { checkIn: '2026-12-20', checkOut: '2026-12-22', rooms: 2 },
    { checkIn: '2026-12-21', checkOut: '2026-12-23', rooms: 1 },
  ];

  it('finds the most rooms needed on one night, counting only nights still to come', () => {
    expect(peakRoomsNeeded(stays, '2026-12-20')).toBe(3);
    expect(peakRoomsNeeded(stays, '2026-12-22')).toBe(1);
    expect(peakRoomsNeeded(stays, '2026-12-23')).toBe(0);
  });

  it('refuses to leave accepted stays short of rooms, and allows it when they still fit', () => {
    expect(roomRemovalError('Single', 2, 3)).toBe(
      'Accepted stays need 3 Single rooms. Keep this room, or move those stays first.',
    );
    expect(roomRemovalError('Single', 3, 3)).toBeNull();
    expect(roomRemovalError('Single', 0, 0)).toBeNull();
  });
});

describe('room billing', () => {
  it('bills only an accepted stay, once, and only at a fixed price', () => {
    expect(roomBillError('SUBMITTED', false, true)).toBe(
      'Only an accepted room stay can be billed.',
    );
    expect(roomBillError('ACCEPTED', true, true)).toBe('This stay is already billed.');
    expect(roomBillError('ACCEPTED', false, false)).toBe('This stay has no fixed price to bill.');
    expect(roomBillError('ACCEPTED', false, true)).toBeNull();
  });

  it('credits a whole room bill once, and never a credit note', () => {
    expect(roomCreditError('CREDIT_NOTE', false)).toBe('Only a room bill can be credited.');
    expect(roomCreditError('INVOICE', true)).toBe('This room bill is already credited.');
    expect(roomCreditError('INVOICE', false)).toBeNull();
  });

  it('lets only finance raise a room bill', () => {
    expect(canRaiseRoomInvoice('FINANCE_OFFICER')).toBe(true);
    expect(canRaiseRoomInvoice('OPERATIONS_MANAGER')).toBe(false);
    expect(canRaiseRoomInvoice('AIRLINE_FINANCE')).toBe(false);
  });
});

describe('stock count status', () => {
  it('keeps a count grey until it is waiting, then green once it is posted', () => {
    expect(countStatusTone('COUNTING')).toBe('draft');
    expect(countStatusTone('WAITING')).toBe('progress');
    expect(countStatusTone('POSTED')).toBe('done');
  });
});

describe('statusTone', () => {
  it('maps the lifecycle onto the shared status colours', () => {
    expect(statusTone('DRAFT')).toBe('draft');
    expect(statusTone('IN_PRODUCTION')).toBe('progress');
    expect(statusTone('INVOICED')).toBe('done');
    expect(statusTone('CANCELLED')).toBe('problem');
  });
});
