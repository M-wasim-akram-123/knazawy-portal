export interface BranchRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export function branchCodeError(code: string): string | null {
  const trimmed = code.trim();
  if (trimmed.length < 2 || trimmed.length > 12) return 'Use a branch code of 2 to 12 characters.';
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) return 'Use letters and digits for the branch code.';
  return null;
}

export function branchNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return 'Use a branch name of 2 to 80 characters.';
  return null;
}

/** Stock work needs the branch the user is in. An airline user has none. */
export function workingBranchError(branchId: string | null | undefined): string | null {
  if (!branchId) return 'Choose a branch before working with stock.';
  return null;
}

/** A branch can be closed only while another branch stays open. */
export function branchCloseError(active: boolean, otherOpenBranches: number): string | null {
  if (active && otherOpenBranches === 0) {
    return 'Keep at least one branch open. Open another branch before closing this one.';
  }
  return null;
}
