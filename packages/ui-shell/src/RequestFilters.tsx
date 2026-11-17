'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

export interface RequestFilterCopy {
  search: string;
  searchPlaceholder: string;
  filterStatus: string;
  filterAirline: string;
  all: string;
  clearFilters: string;
}

interface Filterable {
  status: string;
  /** Optional: a portal list belongs to one airline and has no airline column. */
  airlineId?: string;
  airlineName?: string;
}

/**
 * Search, status, and airline filters for a list of airline requests (meal orders or room
 * requests). Status and airline choices come from the rows themselves, so only real values
 * are offered. `text` says which fields the search box looks in.
 */
export function useRequestFilters<T extends Filterable>(
  rows: readonly T[],
  text: (row: T) => string,
) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [airline, setAirline] = useState('ALL');

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== 'ALL' && row.status !== status) return false;
      if (airline !== 'ALL' && (row.airlineId ?? '') !== airline) return false;
      return !term || text(row).toLowerCase().includes(term);
    });
  }, [rows, search, status, airline, text]);

  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status))], [rows]);
  const airlines = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.airlineId ?? '', row.airlineName ?? '']));
    return [...byId.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [rows]);

  return {
    shown,
    search,
    status,
    airline,
    statuses,
    airlines,
    active: search !== '' || status !== 'ALL' || airline !== 'ALL',
    setSearch,
    setStatus,
    setAirline,
    clear: () => {
      setSearch('');
      setStatus('ALL');
      setAirline('ALL');
    },
  };
}

export function RequestFilters({
  filters,
  copy,
  statusLabel,
  onChange,
  showAirline = true,
  extra,
  extraActive = false,
  onClearExtra,
}: {
  filters: ReturnType<typeof useRequestFilters>;
  copy: RequestFilterCopy;
  /** The status name shown in the choice list, in the page language. */
  statusLabel: (status: string) => string;
  /** Called after any change, such as going back to the first page. */
  onChange: () => void;
  /** An airline sees only its own requests, so the portal leaves the airline choice out. */
  showAirline?: boolean;
  /** More filter fields for this list, shown inside the bar, such as an invoice's kind. */
  extra?: ReactNode;
  /** True when one of the extra fields is set, so "Clear filters" shows. */
  extraActive?: boolean;
  /** Resets the extra fields when "Clear filters" is pressed. */
  onClearExtra?: () => void;
}) {
  return (
    <div className="kz-filters">
      <FilterField label={copy.search}>
        <input
          type="search"
          value={filters.search}
          placeholder={copy.searchPlaceholder}
          onChange={(event) => {
            filters.setSearch(event.target.value);
            onChange();
          }}
        />
      </FilterField>
      <FilterField label={copy.filterStatus}>
        <select
          value={filters.status}
          onChange={(event) => {
            filters.setStatus(event.target.value);
            onChange();
          }}
        >
          <option value="ALL">{copy.all}</option>
          {filters.statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </FilterField>
      {showAirline ? (
        <FilterField label={copy.filterAirline}>
          <select
            value={filters.airline}
            onChange={(event) => {
              filters.setAirline(event.target.value);
              onChange();
            }}
          >
            <option value="ALL">{copy.all}</option>
            {filters.airlines.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </FilterField>
      ) : null}
      {extra}
      {filters.active || extraActive ? (
        <button
          type="button"
          className="kz-button-quiet kz-filters-clear"
          onClick={() => {
            filters.clear();
            onClearExtra?.();
            onChange();
          }}
        >
          {copy.clearFilters}
        </button>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="kz-field">
      <span className="kz-field-label">{label}</span>
      {children}
    </label>
  );
}
