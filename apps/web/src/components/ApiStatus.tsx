'use client';

import { messages } from '@knazawy/i18n';
import { useEffect, useState } from 'react';

export function ApiStatus() {
  const [label, setLabel] = useState<string>(messages.en.common.apiChecking);

  useEffect(() => {
    let cancelled = false;
    fetch('/v1/health')
      .then((response) => {
        if (!response.ok) throw new Error('down');
        return response.json() as Promise<{ status?: string }>;
      })
      .then((body) => {
        if (cancelled) return;
        setLabel(body.status === 'ok' ? messages.en.common.apiOk : messages.en.common.apiDown);
      })
      .catch(() => {
        if (!cancelled) setLabel(messages.en.common.apiDown);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <p className="kz-api">{label}</p>;
}
