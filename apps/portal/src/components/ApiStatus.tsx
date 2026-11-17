'use client';

import { useEffect, useState } from 'react';

import { useCommon } from '../lib/i18n';

export function ApiStatus() {
  const common = useCommon();
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
    status === 'ok' ? common.apiOk : status === 'down' ? common.apiDown : common.apiChecking;

  return (
    <p className="kz-api" data-status={status}>
      {label}
    </p>
  );
}
