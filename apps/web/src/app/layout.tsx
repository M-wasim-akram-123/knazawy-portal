import { LANGUAGE_OPTIONS } from '@knazawy/i18n';
import { PRODUCT_NAME } from '@knazawy/shared';
import { LanguageProvider } from '@knazawy/ui-shell';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { StaffFrame } from '../components/StaffFrame';

import './globals.css';

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: 'Staff tools for the kitchen, the store, and finance.',
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
          <StaffFrame>{children}</StaffFrame>
        </LanguageProvider>
      </body>
    </html>
  );
}
