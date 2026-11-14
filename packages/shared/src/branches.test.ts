import { branchCloseError, branchCodeError, branchNameError, workingBranchError } from './branches';
import { can } from './rbac';

describe('branch rules', () => {
  it('accepts a short code of letters and digits', () => {
    expect(branchCodeError('KHI')).toBeNull();
    expect(branchCodeError('a')).toBe('Use a branch code of 2 to 12 characters.');
    expect(branchCodeError('KHI-1')).toBe('Use letters and digits for the branch code.');
  });

  it('accepts a name of 2 to 80 characters', () => {
    expect(branchNameError('Karachi')).toBeNull();
    expect(branchNameError(' ')).toBe('Use a branch name of 2 to 80 characters.');
  });

  it('asks for a branch before stock work', () => {
    expect(workingBranchError(null)).toBe('Choose a branch before working with stock.');
    expect(workingBranchError('branch-1')).toBeNull();
  });

  it('keeps the last open branch open', () => {
    expect(branchCloseError(true, 0)).toBe(
      'Keep at least one branch open. Open another branch before closing this one.',
    );
    expect(branchCloseError(true, 1)).toBeNull();
    expect(branchCloseError(false, 0)).toBeNull();
  });
});

describe('branch permissions', () => {
  it('lets only an administrator manage branches', () => {
    expect(can('ADMINISTRATOR', 'branches', 'C')).toBe(true);
    expect(can('OPERATIONS_MANAGER', 'branches', 'R')).toBe(false);
    expect(can('FINANCE_OFFICER', 'branches', 'R')).toBe(false);
  });
});
