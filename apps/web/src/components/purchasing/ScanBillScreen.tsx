'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { can, moneyMatches, supplierBillOwed, todayInKarachi } from '@knazawy/shared';
import type { ItemRecord, LocationRecord, SupplierRecord } from '@knazawy/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api, readSessionUser } from '../../lib/session';
import { Field } from '../master/Field';

interface DraftLine {
  key: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
}

export function ScanBillScreen() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billedOn, setBilledOn] = useState(todayInKarachi());
  const [locationId, setLocationId] = useState('');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [billTotal, setBillTotal] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session) return;
    void Promise.all([api.listSuppliers(), api.listItems(), api.listLocations()])
      .then(([nextSuppliers, nextItems, nextLocations]) => {
        const openItems = nextItems.filter((item) => item.active);
        const openSuppliers = nextSuppliers.filter((supplier) => supplier.active);
        const openLocations = nextLocations.filter((location) => location.active);
        setSuppliers(openSuppliers);
        setItems(openItems);
        setLocations(openLocations);
        setSupplierId(openSuppliers[0]?.id ?? '');
        setLocationId(openLocations[0]?.id ?? '');
        setLines([blankLine(openItems[0]?.id ?? '')]);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, setUser)));
  }, []);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!ready) return <p>Loading the bill</p>;
  if (!user) {
    return (
      <p>
        <Link href="/login">{messages.en.common.signIn}</Link> to scan a bill.
      </p>
    );
  }

  function updateLine(key: string, patch: Partial<DraftLine>): void {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const canPost = can(user.role, 'stock', 'C');
  const owed = supplierBillOwed({
    lines: lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })),
    tax: tax || '0',
    discount: discount || '0',
  });
  const totalsMatch = owed.ok && billTotal.trim() !== '' && moneyMatches(owed.owed, billTotal);

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.scanBill}</h1>
        <p>
          Photograph or upload the supplier bill, check the lines, then post. Stock updates and the
          supplier is owed the bill total.
        </p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.scanBill}
        </p>
      </div>
      {!canPost ? <p>You cannot post a supplier bill.</p> : null}
      {canPost ? (
        <div className="kz-workspace">
          <div className="kz-panel kz-stack">
            <h2>Bill</h2>
            <div className="kz-file-actions">
              <label className="kz-button">
                Take a photo
                <input
                  className="kz-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <label className="kz-button-quiet">
                Upload a file
                <input
                  className="kz-file-input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {file ? <p>{file.name}</p> : <p className="kz-empty">No bill chosen yet.</p>}
            {preview ? <img className="kz-bill-preview" src={preview} alt="Supplier bill" /> : null}
          </div>
          <form
            className="kz-panel kz-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!file || !owed.ok || !totalsMatch) return;
              setSaving(true);
              setError('');
              setPosted('');
              void api
                .postBill(
                  {
                    supplierId,
                    billNumber,
                    billedOn,
                    locationId,
                    billTotal,
                    tax: tax || '0',
                    discount: discount || '0',
                    lines: lines.map((line) => ({
                      itemId: line.itemId,
                      quantity: line.quantity,
                      unitPrice: line.unitPrice,
                    })),
                  },
                  file,
                  file.name,
                )
                .then((receipt) => {
                  setPosted(`${receipt.number} is in stock. The supplier is owed ${receipt.billTotal} PKR.`);
                  setBillNumber('');
                  setBillTotal('');
                  setTax('0');
                  setDiscount('0');
                  setLines([blankLine(items[0]?.id ?? '')]);
                  setFile(null);
                })
                .catch((caught: unknown) => setError(explainApiError(caught, setUser)))
                .finally(() => setSaving(false));
            }}
          >
            <h2>Check and post</h2>
            <Field label="Supplier">
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bill number">
              <input value={billNumber} onChange={(event) => setBillNumber(event.target.value)} required />
            </Field>
            <Field label="Bill date" hint="Shown as DD/MM/YYYY.">
              <input type="date" value={billedOn} onChange={(event) => setBilledOn(event.target.value)} required />
            </Field>
            <Field label="Receiving location">
              <select value={locationId} onChange={(event) => setLocationId(event.target.value)} required>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="kz-table-wrap">
              <table className="kz-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <select
                          value={line.itemId}
                          onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
                          required
                        >
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                          required
                        />
                      </td>
                      <td>
                        <input
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })}
                          required
                        />
                      </td>
                      <td>
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            className="kz-button-quiet"
                            onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="kz-button-quiet"
              onClick={() => setLines((current) => [...current, blankLine(items[0]?.id ?? '')])}
            >
              Add a line
            </button>
            <Field label="Tax" hint="PKR. Added to what you owe. Not added to the item cost.">
              <input inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} />
            </Field>
            <Field label="Discount" hint="PKR taken off the bill.">
              <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </Field>
            <Field label="Bill total" hint="PKR, after tax and discount.">
              <input
                inputMode="decimal"
                value={billTotal}
                onChange={(event) => setBillTotal(event.target.value)}
                required
              />
            </Field>
            <p>
              Lines {owed.ok ? owed.lines : '—'} PKR. Amount owed {owed.ok ? owed.owed : '—'} PKR.
            </p>
            {owed.ok && billTotal.trim() !== '' && !totalsMatch ? (
              <p className="kz-error">The lines do not add up to the bill total.</p>
            ) : null}
            {owed.ok === false && owed.reason === 'discount' ? (
              <p className="kz-error">The discount is larger than the bill.</p>
            ) : null}
            {error ? (
              <p className="kz-error" role="alert">
                {error}
              </p>
            ) : null}
            {posted ? <p>{posted}</p> : null}
            <button className="kz-button" type="submit" disabled={saving || !file || !totalsMatch}>
              {saving ? 'Posting' : 'Post to stock'}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function blankLine(itemId = ''): DraftLine {
  return { key: `${Date.now()}-${Math.random()}`, itemId, quantity: '', unitPrice: '' };
}
