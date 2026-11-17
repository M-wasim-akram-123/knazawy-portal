import { LANGUAGE_OPTIONS } from '@knazawy/i18n';
import { PRODUCT_NAME } from '@knazawy/shared';
import { LanguageProvider } from '@knazawy/ui-shell';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { PortalFrame } from '../components/PortalFrame';

import './globals.css';

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} portal`,
  description: 'Airline and hotel requests, rates, and invoices.',
  icons: { icon: '/karam-dome-mark.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider options={LANGUAGE_OPTIONS}>
          <PortalFrame>{children}</PortalFrame>
        </LanguageProvider>
      </body>
    </html>
  );
}
