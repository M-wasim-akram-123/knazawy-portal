'use client';

import { useEffect, useState } from 'react';

import { KaramLoader } from './KaramLoader';

/**
 * Shows the Karam loader over the page while the API is answering. It waits a moment before
 * appearing, so a quick answer never flashes it. `subscribe` reports how many requests are in
 * flight and returns the function that stops listening.
 */
export function LoadingOverlay({
  subscribe,
  label,
  delayMs = 250,
}: {
  subscribe: (listener: (pending: number) => void) => () => void;
  label: string;
  delayMs?: number;
}) {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribe(setPending), [subscribe]);

  useEffect(() => {
    if (pending === 0) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [pending, delayMs]);

  if (!visible) return null;
  return (
    <div className="kz-loading-overlay">
      <KaramLoader label={label} size={76} />
    </div>
  );
}
