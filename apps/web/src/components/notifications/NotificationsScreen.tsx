'use client';

import { messages } from '@knazawy/i18n';
import { formatKarachiDateTime, type NotificationRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { explainApiError } from '../../lib/explain';
import { api } from '../../lib/session';

export function NotificationsScreen() {
  const [rows, setRows] = useState<NotificationRecord[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.listNotifications(), api.unreadNotificationCount()])
      .then(([notifications, count]) => {
        setRows(notifications);
        setUnreadCount(count);
      })
      .catch((caught: unknown) => setError(explainApiError(caught, () => undefined)));
  }, []);

  async function markRead(id: string) {
    setMarkingId(id);
    setError('');
    try {
      const updated = await api.markNotificationRead(id);
      setRows((current) => current?.map((row) => (row.id === updated.id ? updated : row)) ?? null);
      setUnreadCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event('karam-notifications-updated'));
    } catch (caught: unknown) {
      setError(explainApiError(caught, () => undefined));
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError('');
    try {
      const result = await api.markAllNotificationsRead();
      setRows(
        (current) =>
          current?.map((row) => (row.readAt ? row : { ...row, readAt: result.readAt })) ?? null,
      );
      setUnreadCount(0);
      window.dispatchEvent(new Event('karam-notifications-updated'));
    } catch (caught: unknown) {
      setError(explainApiError(caught, () => undefined));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{messages.en.common.notifications}</h1>
        <p>Messages about requests, deliveries, invoices, and disputes. These stay in the app.</p>
        <p lang="ur" dir="rtl">
          {messages.ur.common.notifications}
        </p>
        {unreadCount > 0 ? (
          <div className="kz-notification-page-actions">
            <span>
              {unreadCount} {messages.en.common.unread}
            </span>
            <button
              type="button"
              className="kz-button-quiet"
              onClick={() => void markAllRead()}
              disabled={markingAll || markingId !== null}
            >
              {messages.en.common.markAllAsRead}
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows === null && !error ? <p>{messages.en.common.notificationsLoading}</p> : null}
      {rows !== null && rows.length === 0 ? (
        <p className="kz-empty">{messages.en.common.noNotifications}</p>
      ) : null}
      {rows?.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.title}{' '}
            {row.readAt ? null : (
              <span className="kz-status" data-tone="progress">
                {messages.en.common.newNotification}
              </span>
            )}
          </h2>
          <p>{row.body}</p>
          <p className="kz-help">{formatKarachiDateTime(new Date(row.createdAt))}</p>
          {row.readAt ? null : (
            <button
              type="button"
              className="kz-button-quiet"
              onClick={() => void markRead(row.id)}
              disabled={markingAll || markingId === row.id}
            >
              {messages.en.common.markAsRead}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
