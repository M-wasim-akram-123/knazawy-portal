import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="kz-field">
      <span>{label}</span>
      {children}
      {hint ? <span className="kz-help">{hint}</span> : null}
    </label>
  );
}
