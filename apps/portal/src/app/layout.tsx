import { PRODUCT_NAME } from '@knazawy/shared';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PortalFrame } from '../components/PortalFrame';

import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} portal`,
  description: 'Airline and hotel requests, rates, and invoices.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PortalFrame>{children}</PortalFrame>
      </body>
    </html>
  );
}
