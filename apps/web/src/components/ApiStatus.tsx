'use client';

import { messages } from '@knazawy/i18n';
import { useEffect, useState } from 'react';

export function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch('/v1/health')
      .then((response) => {
        if (!response.ok) throw new Error('down');
        return response.json() as Promise<{ status?: string }>;
      })
      .then((body) => {
        if (cancelled) return;
        setStatus(body.status === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    status === 'ok'
      ? messages.en.common.apiOk
      : status === 'down'
        ? messages.en.common.apiDown
        : messages.en.common.apiChecking;

  return (
    <p className="kz-api" data-status={status}>
      {label}
    </p>
  );
}
