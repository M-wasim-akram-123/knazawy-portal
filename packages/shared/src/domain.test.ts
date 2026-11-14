import { isAirlineRole } from './airlines';
import { moneyMatches, supplierBillOwed } from './bills';
import { costDifference, costOnePortion } from './costing';
import { formatDisplayDate, todayInKarachi } from './dates';
import { can, canReadOrganisation } from './rbac';
import { recipeIngredientQuantity } from './recipes';
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
