import { messages } from '@knazawy/i18n';
import { PRODUCT_NAME } from '@knazawy/shared';
import { AppShell } from '@knazawy/ui-shell';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: 'Staff tools for the kitchen, the store, and finance.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell
          productName={messages.en.common.productName}
          surface={messages.en.common.staffSurface}
          alternateName={messages.ur.common.productName}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
