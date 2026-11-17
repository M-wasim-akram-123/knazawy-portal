'use client';

import { useEffect, useMemo, useState } from 'react';

/** One page of a list held in memory, and the controls to move between pages. */
export function usePage<T>(items: readonly T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // A list that shrinks (a filter, a deleted row) must not leave us on a page that is gone.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const current = Math.min(page, pageCount);
  const rows = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  return {
    rows,
    page: current,
    pageCount,
    total: items.length,
    from: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, items.length),
    setPage,
  };
}

export interface PaginationLabels {
  previous: string;
  next: string;
  /** Such as "{from}–{to} of {total}". */
  showingRange: string;
}

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  labels,
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (page: number) => void;
  labels: PaginationLabels;
}) {
  if (total === 0) return null;
  const range = labels.showingRange
    .replace('{from}', String(from))
    .replace('{to}', String(to))
    .replace('{total}', String(total));
  return (
    <nav className="kz-pagination" aria-label={range}>
      <span className="kz-pagination-range">{range}</span>
      {pageCount > 1 ? (
        <span className="kz-pagination-buttons">
          <button
            type="button"
            className="kz-button-quiet"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {labels.previous}
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              className="kz-pagination-page"
              aria-current={number === page ? 'page' : undefined}
              onClick={() => onPage(number)}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            className="kz-button-quiet"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
          >
            {labels.next}
          </button>
        </span>
      ) : null}
    </nav>
  );
}
