import { isAirlineRole } from './airlines';
import { moneyMatches, supplierBillOwed } from './bills';
import { costDifference, costOnePortion } from './costing';
import { formatDisplayDate, todayInKarachi } from './dates';
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
import { recipeIngredientQuantity } from './recipes';
import { isRequestEditable, nextRequestStatus, passengerTotal } from './requests';
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
    expect(nextRequestStatus('ACCEPTED', 'cancel')).toBeNull();
    expect(nextRequestStatus('REJECTED', 'accept')).toBeNull();
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
