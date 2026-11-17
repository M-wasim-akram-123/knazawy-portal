import {
  airlineTermsError,
  applyDiscount,
  canSetAirlineTerms,
  invoiceDueOn,
  invoiceSummary,
  isOverdue,
  termsLabel,
} from './terms';

describe('airline terms', () => {
  it('takes the discount off, rounding half up to the paisa', () => {
    expect(applyDiscount('1000.00', '5')).toEqual({ discount: '50.00', total: '950.00' });
    expect(applyDiscount('99.99', '2.5')).toEqual({ discount: '2.50', total: '97.49' });
    expect(applyDiscount('100.00', '0')).toEqual({ discount: '0.00', total: '100.00' });
    expect(applyDiscount('100.00', '100')).toEqual({ discount: '100.00', total: '0.00' });
  });

  it('refuses a discount it cannot apply', () => {
    expect(applyDiscount('100.00', '100.01')).toBeNull();
    expect(applyDiscount('100.00', '-1')).toBeNull();
    expect(applyDiscount('100.00', '2.555')).toBeNull();
    expect(applyDiscount('abc', '5')).toBeNull();
  });

  it('sets the due date from the issue date, across a month end', () => {
    expect(invoiceDueOn('2026-11-17', 30)).toBe('2026-12-17');
    expect(invoiceDueOn('2026-01-31', 30)).toBe('2026-03-02');
    expect(invoiceDueOn('2026-11-17', 0)).toBe('2026-11-17');
  });

  it('is overdue only when money is still owed after the due date', () => {
    expect(isOverdue('2026-11-16', '2026-11-17', '10.00')).toBe(true);
    expect(isOverdue('2026-11-17', '2026-11-17', '10.00')).toBe(false);
    expect(isOverdue('2026-11-16', '2026-11-17', '0.00')).toBe(false);
    expect(isOverdue(null, '2026-11-17', '10.00')).toBe(false);
  });

  it('checks the terms', () => {
    expect(airlineTermsError({ paymentTermsDays: 30, discountPercent: '5' })).toBeNull();
    expect(airlineTermsError({ paymentTermsDays: -1, discountPercent: '0' })).toMatch(/days/);
    expect(airlineTermsError({ paymentTermsDays: 181, discountPercent: '0' })).toMatch(/days/);
    expect(airlineTermsError({ paymentTermsDays: 30, discountPercent: '101' })).toMatch(/Discount/);
  });

  it('names the terms in plain words', () => {
    expect(termsLabel(30)).toBe('Net 30');
    expect(termsLabel(0)).toBe('Due on receipt');
  });

  it('lets finance and administrators set terms, never an airline', () => {
    expect(canSetAirlineTerms('FINANCE_OFFICER')).toBe(true);
    expect(canSetAirlineTerms('ADMINISTRATOR')).toBe(true);
    expect(canSetAirlineTerms('STOREKEEPER')).toBe(false);
    expect(canSetAirlineTerms('AIRLINE_FINANCE')).toBe(false);
  });
});

describe('invoice summary', () => {
  const base = {
    subtotal: '13000.00',
    discountPercent: '5',
    discount: '650.00',
    total: '12350.00',
    amountDue: '12350.00',
    paymentTermsDays: 30,
    dueOn: '2026-12-17',
    kind: 'INVOICE',
  };

  it('shows the discount, the total, and when it is due', () => {
    expect(invoiceSummary(base, '2026-11-17')).toBe(
      'Subtotal 13000.00 PKR, less 5% discount 650.00 PKR. Total 12350.00 PKR. Amount due 12350.00 PKR. Net 30, due 17/12/2026.',
    );
  });

  it('says when it is overdue, and leaves out a discount of nothing', () => {
    expect(invoiceSummary({ ...base, discount: '0.00', discountPercent: '0' }, '2026-12-18')).toBe(
      'Total 12350.00 PKR. Amount due 12350.00 PKR. Net 30, due 17/12/2026. Overdue.',
    );
  });
});
