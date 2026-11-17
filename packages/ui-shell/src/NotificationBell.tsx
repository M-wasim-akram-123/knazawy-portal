'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * The bell both apps show in their header. It knows nothing about the API or the router: each
 * app passes a source that fetches and watches notifications, the copy, and its own link.
 */

export interface BellNotification {
  id: string;
  title: string;
  body: string;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}

export interface BellPing {
  title: string;
  body: string;
  entityId: string;
}

export interface NotificationSource {
  list(): Promise<BellNotification[]>;
  unreadCount(): Promise<number>;
  markRead(id: string): Promise<BellNotification>;
  markAllRead(): Promise<{ readAt: string }>;
  /** Opens the live stream. Returns the function that closes it. */
  watch(handlers: { onPing: (ping: BellPing) => void; onSignedOut: () => void }): () => void;
  /** True when an error means the session has ended. */
  isSignedOut(error: unknown): boolean;
}

export interface NotificationBellLabels {
  notifications: string;
  unread: string;
  markAsRead: string;
  markAllAsRead: string;
  viewAllNotifications: string;
  noNotifications: string;
  notificationsLoading: string;
  notificationsError: string;
}

export interface NotificationBellProps {
  source: NotificationSource;
  labels: NotificationBellLabels;
  formatTime: (iso: string) => string;
  onSignedOut: () => void;
  /** The "view all" link, built with the app's router. */
  renderAllLink: (className: string, text: string) => ReactNode;
}

export function NotificationBell({
  source,
  labels,
  formatTime,
  onSignedOut,
  renderAllLink,
}: NotificationBellProps) {
  const [rows, setRows] = useState<BellNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const explain = (caught: unknown): string | null => {
    if (source.isSignedOut(caught)) {
      onSignedOut();
      return null;
    }
    return caught instanceof Error ? caught.message : labels.notificationsError;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [notifications, count] = await Promise.all([source.list(), source.unreadCount()]);
        if (active) {
          setRows(notifications);
          setUnreadCount(count);
          setError('');
        }
      } catch (caught: unknown) {
        const message = explain(caught);
        if (active && message) setError(message);
      }
    };

    void load();
    // Live: the API pings the moment a notification is written. The write may still be
    // committing, so load again shortly after. The minute poll stays as a fallback.
    let followUp: number | undefined;
    const stopWatching = source.watch({
      onPing: (ping) => {
        void load();
        window.clearTimeout(followUp);
        followUp = window.setTimeout(() => void load(), 1_500);
        showDesktopNotification(ping);
      },
      onSignedOut,
    });
    const interval = window.setInterval(() => void load(), 60_000);
    window.addEventListener('focus', load);
    window.addEventListener('karam-notifications-updated', load);
    return () => {
      active = false;
      stopWatching();
      window.clearTimeout(followUp);
      window.clearInterval(interval);
      window.removeEventListener('focus', load);
      window.removeEventListener('karam-notifications-updated', load);
    };
    // The source and handlers are created once per app; reconnecting on every render would
    // drop the live stream.
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
      const updated = await source.markRead(id);
      setRows((current) => current?.map((row) => (row.id === id ? updated : row)) ?? null);
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (caught: unknown) {
      const message = explain(caught);
      if (message) setError(message);
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError('');
    try {
      const result = await source.markAllRead();
      setRows(
        (current) =>
          current?.map((row) => (row.readAt ? row : { ...row, readAt: result.readAt })) ?? null,
      );
      setUnreadCount(0);
    } catch (caught: unknown) {
      const message = explain(caught);
      if (message) setError(message);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="kz-notification-menu" ref={menuRef}>
      <button
        type="button"
        className="kz-notification-trigger"
        aria-label={`${labels.notifications}, ${unreadCount} ${labels.unread}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="kz-notification-popover"
        onClick={() => {
          askForDesktopNotifications();
          setOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span>{labels.notifications}</span>
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
          aria-label={labels.notifications}
        >
          <div className="kz-notification-heading">
            <div>
              <strong>{labels.notifications}</strong>
              <span>
                {unreadCount} {labels.unread}
              </span>
            </div>
            <button
              type="button"
              className="kz-notification-mark-all"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0 || markingAll || markingId !== null}
            >
              {labels.markAllAsRead}
            </button>
          </div>
          {error ? (
            <p className="kz-error" role="alert">
              {error}
            </p>
          ) : null}
          {rows === null && !error ? (
            <p className="kz-notification-empty">{labels.notificationsLoading}</p>
          ) : null}
          {rows?.length === 0 ? (
            <p className="kz-notification-empty">{labels.noNotifications}</p>
          ) : null}
          {rows?.slice(0, 5).map((row) => (
            <article className={`kz-notification-item${row.readAt ? ' is-read' : ''}`} key={row.id}>
              <span className="kz-notification-dot" aria-hidden="true" />
              <div>
                <strong>{row.title}</strong>
                <p>{row.body}</p>
                <time dateTime={row.createdAt}>{formatTime(row.createdAt)}</time>
              </div>
              {row.readAt ? null : (
                <button
                  type="button"
                  className="kz-notification-read"
                  onClick={() => void markRead(row.id)}
                  disabled={markingAll || markingId !== null}
                  aria-label={`${labels.markAsRead}: ${row.title}`}
                >
                  {labels.markAsRead}
                </button>
              )}
            </article>
          ))}
          {renderAllLink('kz-notification-footer', labels.viewAllNotifications)}
        </section>
      ) : null}
    </div>
  );
}

/** Asked from a click, which browsers require. Only once: a refusal is respected. */
function askForDesktopNotifications(): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  void Notification.requestPermission();
}

/** A system notification when the tab is in the background and the user has allowed it. */
function showDesktopNotification(ping: BellPing): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const notice = new Notification(ping.title, { body: ping.body, tag: ping.entityId || undefined });
  notice.onclick = () => {
    window.focus();
    notice.close();
  };
}
