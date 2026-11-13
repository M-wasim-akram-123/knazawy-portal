import type { ReactNode } from 'react';

export interface AppShellProps {
  productName: string;
  surface: string;
  alternateName?: string;
  children: ReactNode;
}

export function AppShell({ productName, surface, alternateName, children }: AppShellProps) {
  return (
    <div className="kz-shell">
      <header className="kz-header">
        <p className="kz-eyebrow">{surface}</p>
        <p className="kz-product">{productName}</p>
        {alternateName ? (
          <p className="kz-alt" lang="ur" dir="rtl">
            {alternateName}
          </p>
        ) : null}
      </header>
      <main className="kz-main">{children}</main>
    </div>
  );
}
