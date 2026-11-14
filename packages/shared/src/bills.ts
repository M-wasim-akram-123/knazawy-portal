export interface BillLineAmount {
  quantity: string;
  unitPrice: string;
}

export type BillAmountResult =
  | { ok: true; lines: string; owed: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'discount' };

/** Line amounts round half-up to paisa. Tax is added and the discount is taken off. */
export function supplierBillOwed(input: {
  lines: BillLineAmount[];
  tax: string;
  discount: string;
}): BillAmountResult {
  if (input.lines.length === 0) return { ok: false, reason: 'empty' };
  let lines = 0n;
  for (const line of input.lines) {
    const amount = lineAmountPaisa(line.quantity, line.unitPrice);
    if (amount === null) return { ok: false, reason: 'invalid' };
    lines += amount;
  }
  const tax = parseScaled(input.tax, 2);
  const discount = parseScaled(input.discount, 2);
  if (tax === null || discount === null || tax < 0n || discount < 0n) {
    return { ok: false, reason: 'invalid' };
  }
  if (discount > lines + tax) return { ok: false, reason: 'discount' };
  return { ok: true, lines: formatPaisa(lines), owed: formatPaisa(lines + tax - discount) };
}

export function moneyMatches(left: string, right: string): boolean {
  const a = parseScaled(left, 2);
  const b = parseScaled(right, 2);
  return a !== null && a === b;
}

function lineAmountPaisa(quantity: string, unitPrice: string): bigint | null {
  const qty = parseScaled(quantity, 3);
  const price = parseScaled(unitPrice, 2);
  if (qty === null || price === null || qty <= 0n || price <= 0n) return null;
  const product = price * qty;
  const paisa = product / 1000n;
  const remainder = product % 1000n;
  return remainder >= 500n ? paisa + 1n : paisa;
}

function parseScaled(value: string, scale: number): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > scale) return null;
  return BigInt(whole + fraction.padEnd(scale, '0'));
}

function formatPaisa(paisa: bigint): string {
  const negative = paisa < 0n;
  const absolute = negative ? -paisa : paisa;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}
