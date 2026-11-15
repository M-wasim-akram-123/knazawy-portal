'use client';

import { messages } from '@knazawy/i18n';
import { formatKarachiDateTime, type NotificationRecord } from '@knazawy/shared';
import { useEffect, useRef, useState } from 'react';

import { ApiError, api, clearSession } from '../../lib/session';

export function NotificationBell() {
  const [rows, setRows] = useState<NotificationRecord[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [notifications, count] = await Promise.all([
          api.listNotifications(),
          api.unreadNotificationCount(),
        ]);
        if (active) {
          setRows(notifications);
          setUnreadCount(count);
          setError('');
        }
      } catch (caught: unknown) {
        if (caught instanceof ApiError && caught.status === 401) {
          clearSession();
          window.location.assign('/login');
          return;
        }
        if (active) {
          setError(
            caught instanceof Error ? caught.message : messages.en.common.notificationsError,
          );
        }
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    window.addEventListener('focus', load);
    window.addEventListener('karam-notifications-updated', load);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
      window.removeEventListener('karam-notifications-updated', load);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function markRead(id: string) {
    setMarkingId(id);
    setError('');
    try {
      const updated = await api.markNotificationRead(id);
      setRows((current) => current?.map((row) => (row.id === id ? updated : row)) ?? null);
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearSession();
        window.location.assign('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : messages.en.common.notificationsError);
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
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearSession();
        window.location.assign('/login');
        return;
      }
      setError(caught instanceof Error ? caught.message : messages.en.common.notificationsError);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="kz-notification-menu" ref={menuRef}>
      <button
        type="button"
        className="kz-notification-trigger"
        aria-label={`${messages.en.common.notifications}, ${unreadCount} ${messages.en.common.unread}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="kz-notification-popover"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span>{messages.en.common.notifications}</span>
        {unreadCount > 0 ? (
          <span className="kz-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <section
          className="kz-notification-popover"
          id="kz-notification-popover"
          role="dialog"
          aria-modal="false"
          aria-label={messages.en.common.notifications}
        >
          <div className="kz-notification-heading">
            <div>
              <strong>{messages.en.common.notifications}</strong>
              <span>
                {unreadCount} {messages.en.common.unread}
              </span>
            </div>
            <button
              type="button"
              className="kz-notification-mark-all"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0 || markingAll || markingId !== null}
            >
              {messages.en.common.markAllAsRead}
            </button>
          </div>
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {rows === null && !error ? (
            <p className="kz-notification-empty">{messages.en.common.notificationsLoading}</p>
          ) : null}
          {rows?.length === 0 ? (
            <p className="kz-notification-empty">{messages.en.common.noNotifications}</p>
          ) : null}
          {rows?.slice(0, 5).map((row) => (
            <article className={`kz-notification-item${row.readAt ? ' is-read' : ''}`} key={row.id}>
              <span className="kz-notification-dot" aria-hidden="true" />
              <div>
                <strong>{row.title}</strong>
                <p>{row.body}</p>
                <time dateTime={row.createdAt}>
                  {formatKarachiDateTime(new Date(row.createdAt))}
                </time>
              </div>
              {row.readAt ? null : (
                <button
                  type="button"
                  className="kz-notification-read"
                  onClick={() => void markRead(row.id)}
                  disabled={markingAll || markingId !== null}
                  aria-label={`${messages.en.common.markAsRead}: ${row.title}`}
                >
                  {messages.en.common.markAsRead}
                </button>
              )}
            </article>
          ))}
          <a className="kz-notification-footer" href="/notifications">
            {messages.en.common.viewAllNotifications}
          </a>
        </section>
      ) : null}
    </div>
  );
}
