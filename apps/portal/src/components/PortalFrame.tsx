'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { AIRLINE_ROLE_LABELS, can, isAirlineRole, type Area, type Role } from '@knazawy/shared';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { clearSession, readSessionUser } from '../lib/session';

const links: Array<{ href: string; label: string; area?: Area }> = [
  { href: '/', label: messages.en.common.home },
  { href: '/notifications', label: messages.en.common.notifications },
  { href: '/requests', label: messages.en.common.requests, area: 'service_requests' },
  { href: '/room-requests', label: messages.en.common.roomRequests, area: 'room_requests' },
  { href: '/deliveries', label: messages.en.common.deliveries, area: 'distribution' },
  { href: '/rates', label: messages.en.common.rateCards, area: 'service_rates' },
  { href: '/invoices', label: messages.en.common.invoices, area: 'invoices' },
  { href: '/disputes', label: messages.en.common.disputes, area: 'disputes' },
  { href: '/ledger', label: messages.en.common.ledger, area: 'ledger' },
];

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const signingIn = pathname === '/login';

  useEffect(() => {
    const session = readSessionUser();
    setUser(session);
    setReady(true);
    if (!session && !signingIn) router.replace('/login');
    if (session && signingIn) router.replace('/');
  }, [pathname, router, signingIn]);

  if (signingIn) {
    return (
      <div className="kz-signin">
        <header className="kz-topbar">
          <Brand />
        </header>
        <main className="kz-signin-main">{children}</main>
      </div>
    );
  }

  if (!ready || !user) return <p className="kz-booting">Loading</p>;

  const visible = links.filter((link) => !link.area || can(user.role, link.area, 'R'));

  return (
    <div className="kz-app">
      <header className="kz-topbar">
        <Brand />
        <div className="kz-top-user">
          <p>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.role)}</span>
          </p>
          <button
            type="button"
            className="kz-button-quiet"
            onClick={() => {
              clearSession();
              setUser(null);
              router.push('/login');
              router.refresh();
            }}
          >
            {messages.en.common.signOut}
          </button>
        </div>
      </header>
      <div className="kz-body">
        <nav className="kz-side" aria-label="Portal">
          {visible.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <main className="kz-content">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="kz-brand">
      <strong>{messages.en.common.productName}</strong>
      <span>
        {messages.en.common.portalSurface}
        {' · '}
        <span lang="ur" dir="rtl">
          {messages.ur.common.portalSurface}
        </span>
      </span>
    </div>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role: Role): string {
  if (isAirlineRole(role)) return AIRLINE_ROLE_LABELS[role];
  const words = role.toLowerCase().split('_');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
