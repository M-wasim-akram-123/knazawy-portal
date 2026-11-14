'use client';

import { messages } from '@knazawy/i18n';
import { formatKarachiDateTime, type NotificationRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

export function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .listNotifications()
      .then(setRows)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Notifications could not load.');
      });
  }, []);

  async function markRead(id: string) {
    try {
      const updated = await api.markNotificationRead(id);
      setRows((current) => current?.map((row) => (row.id === updated.id ? updated : row)) ?? null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That message could not be updated.');
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.notifications}</h1>
        <p>Messages about your airline&apos;s requests, deliveries, invoices, and disputes.</p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.notifications}
        </p>
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows === null && !error ? <p>Loading</p> : null}
      {rows !== null && rows.length === 0 ? <p className="kz-empty">No messages yet.</p> : null}
      {rows?.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.title}{' '}
            {row.readAt ? null : (
              <span className="kz-status" data-tone="progress">
                New
              </span>
            )}
          </h2>
          <p>{row.body}</p>
          <p className="kz-help">{formatKarachiDateTime(new Date(row.createdAt))}</p>
          {row.readAt ? null : (
            <button type="button" className="kz-button-quiet" onClick={() => void markRead(row.id)}>
              Mark as read
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
