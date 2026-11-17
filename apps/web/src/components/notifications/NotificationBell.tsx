'use client';

import { watchNotifications } from '@knazawy/api-client';
import { formatKarachiDateTime } from '@knazawy/shared';
import { NotificationBell as Bell, type NotificationSource } from '@knazawy/ui-shell';
import Link from 'next/link';

import { useCommon } from '../../lib/i18n';
import { ApiError, api, clearSession } from '../../lib/session';

/** Connects the shared bell to this app's API client, copy, and router. */
const source: NotificationSource = {
  list: () => api.listNotifications(),
  unreadCount: () => api.unreadNotificationCount(),
  markRead: (id) => api.markNotificationRead(id),
  markAllRead: () => api.markAllNotificationsRead(),
  watch: (handlers) => watchNotifications(api, handlers),
  isSignedOut: (error) => error instanceof ApiError && error.status === 401,
};

function signOut(): void {
  clearSession();
  window.location.assign('/login');
}

export function NotificationBell() {
  const common = useCommon();
  return (
    <Bell
      source={source}
      labels={common}
      formatTime={(iso) => formatKarachiDateTime(new Date(iso))}
      onSignedOut={signOut}
      renderAllLink={(className, text) => (
        <Link className={className} href="/notifications">
          {text}
        </Link>
      )}
    />
  );
}
