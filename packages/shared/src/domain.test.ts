import { can, canReadOrganisation } from './rbac';
import { statusTone } from './status';

describe('permissions', () => {
  it('lets the storekeeper create a purchase and blocks the airline requester', () => {
    expect(can('STOREKEEPER', 'purchases', 'C')).toBe(true);
    expect(can('AIRLINE_REQUESTER', 'purchases', 'C')).toBe(false);
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

describe('statusTone', () => {
  it('maps the lifecycle onto the shared status colours', () => {
    expect(statusTone('DRAFT')).toBe('draft');
    expect(statusTone('IN_PRODUCTION')).toBe('progress');
    expect(statusTone('INVOICED')).toBe('done');
    expect(statusTone('CANCELLED')).toBe('problem');
  });
});
