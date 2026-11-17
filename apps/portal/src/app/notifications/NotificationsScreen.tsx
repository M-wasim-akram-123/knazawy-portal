'use client';

import { portalNotificationsCopy } from '@knazawy/i18n';
import { formatKarachiDateTime, type NotificationRecord } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { useCommon, useCopy } from '../../lib/i18n';
import { ApiError, api, clearSession } from '../../lib/session';

export function NotificationsScreen() {
  const t = useCopy(portalNotificationsCopy);
  const common = useCommon();
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
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        setError(caught instanceof Error ? caught.message : common.notificationsError);
      });
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
      setError(caught instanceof Error ? caught.message : t.oneFailed);
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
      if (caught instanceof ApiError && caught.status === 401) {
        clearSession();
        window.location.assign('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : t.allFailed);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <section className="kz-stack">
      <div className="kz-page-head">
        <h1>{common.notifications}</h1>
        <p>{t.intro}</p>
        {unreadCount > 0 ? (
          <div className="kz-notification-page-actions">
            <span>
              {unreadCount} {common.unread}
            </span>
            <button
              type="button"
              className="kz-button-quiet"
              onClick={() => void markAllRead()}
              disabled={markingAll || markingId !== null}
            >
              {common.markAllAsRead}
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
      {rows === null && !error ? <p>{common.notificationsLoading}</p> : null}
      {rows !== null && rows.length === 0 ? (
        <p className="kz-empty">{common.noNotifications}</p>
      ) : null}
      {rows?.map((row) => (
        <article key={row.id} className="kz-panel kz-stack">
          <h2>
            {row.title}{' '}
            {row.readAt ? null : (
              <span className="kz-status" data-tone="progress">
                {common.newNotification}
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
              {common.markAsRead}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
