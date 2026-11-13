import { messages } from '@knazawy/i18n';
import { PRODUCT_NAME } from '@knazawy/shared';
import { AppShell } from '@knazawy/ui-shell';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} portal`,
  description: 'Airline and hotel requests, rates, and invoices.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell
          productName={messages.en.common.productName}
          surface={messages.en.common.portalSurface}
          alternateName={messages.ur.common.portalSurface}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
