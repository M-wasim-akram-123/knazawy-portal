export const PRODUCT_NAME = 'Karam Restaurant Platform';

/** Confirmed for this project. Issues consume the oldest receipt layer first. */
export const STOCK_VALUATION = 'FIFO' as const;

export const DEFAULT_CURRENCY = 'PKR';

export const DEFAULT_TIMEZONE = 'Asia/Karachi';

export const LOCALES = ['en', 'ur'] as const;

export type Locale = (typeof LOCALES)[number];

export const PORTS = {
  web: 3000,
  api: 3001,
  portal: 3002,
} as const;

export const MODULES = [
  {
    id: 'restaurant',
    phase: '1A',
    title: 'Restaurant and inventory',
    summary: 'Items, purchasing, bill scanning, stock, recipes, production, and meal cost.',
  },
  {
    id: 'billing',
    phase: '1B',
    title: 'Airline portal and billing',
    summary: 'Requests, rate cards, distribution, invoices, and the ledger.',
  },
  {
    id: 'hotel',
    phase: '2',
    title: 'Hotel coordination',
    summary: 'Room requests, room prices, acceptance, check-in, and room bills.',
  },
  {
    id: 'growth',
    phase: '3',
    title: 'Enhancements',
    summary: 'Forecasting, messaging, accounting export integration, and multi-branch.',
  },
] as const;
