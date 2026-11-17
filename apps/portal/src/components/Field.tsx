import { useState } from 'react';
import type { ReactNode } from 'react';

import { useCommon } from '../lib/i18n';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const common = useCommon();
  const [hintOpen, setHintOpen] = useState(false);

  return (
    <label className="kz-field">
      <span className="kz-field-label">
        {label}
        {hint ? (
          <span
            className="kz-field-info"
            role="button"
            tabIndex={0}
            aria-label={`${common.information}: ${hint}`}
            aria-expanded={hintOpen}
            title={hint}
            data-hint={hint}
            data-open={hintOpen}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setHintOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              setHintOpen((open) => !open);
            }}
            onBlur={() => setHintOpen(false)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.25" />
              <path d="M8 7v4M8 5h.01" />
            </svg>
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
