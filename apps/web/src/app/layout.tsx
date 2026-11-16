import { PRODUCT_NAME } from '@knazawy/shared';
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
        <StaffFrame>{children}</StaffFrame>
      </body>
    </html>
  );
}
