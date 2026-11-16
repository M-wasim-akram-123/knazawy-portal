'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { AIRLINE_ROLE_LABELS, can, isAirlineRole, type Area, type Role } from '@knazawy/shared';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { clearSession, readSessionUser } from '../lib/session';

import { NotificationBell } from './NotificationBell';

const navigationGroups: Array<{
  label: string;
  links: Array<{ href: string; label: string; area?: Area }>;
}> = [
  {
    label: 'Overview',
    links: [{ href: '/', label: messages.en.common.home }],
  },
  {
    label: 'Services',
    links: [
      { href: '/requests', label: messages.en.common.requests, area: 'service_requests' },
      { href: '/room-requests', label: messages.en.common.roomRequests, area: 'room_requests' },
      { href: '/deliveries', label: messages.en.common.deliveries, area: 'distribution' },
      { href: '/rates', label: messages.en.common.rateCards, area: 'service_rates' },
    ],
  },
  {
    label: 'Finance',
    links: [
      { href: '/invoices', label: messages.en.common.invoices, area: 'invoices' },
      { href: '/disputes', label: messages.en.common.disputes, area: 'disputes' },
      { href: '/ledger', label: messages.en.common.ledger, area: 'ledger' },
    ],
  },
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
    if (session && !signingIn && !canAccessPortalPage(session.role, pathname)) {
      router.replace('/');
    }
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
  if (!canAccessPortalPage(user.role, pathname)) {
    return <p className="kz-booting">This page is not available for your role.</p>;
  }

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !link.area || can(user.role, link.area, 'R')),
    }))
    .filter((group) => group.links.length > 0);
  const activeLink = navigationGroups
    .flatMap((group) => group.links)
    .find((link) => isCurrent(pathname, link.href));

  return (
    <div className="kz-app">
      <header className="kz-topbar">
        <Brand />
        <div className="kz-header-context">
          <span>PARTNER / WORKSPACE</span>
          <strong>{activeLink?.label ?? messages.en.common.home}</strong>
        </div>
        <div className="kz-top-user">
          {isAirlineRole(user.role) ? <NotificationBell /> : null}
          <span className="kz-user-avatar" aria-hidden="true">
            {user.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part.charAt(0))
              .join('')
              .toUpperCase()}
          </span>
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
          {visibleGroups.map((group) => (
            <div className="kz-nav-group" key={group.label}>
              <span className="kz-nav-label">{group.label}</span>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="kz-side-footer">
            <span className="kz-footer-dot" aria-hidden="true" />
            Private partner access
          </div>
        </nav>
        <main className="kz-content">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="kz-brand">
      <Image className="kz-brand-logo" src="/karam-dome-mark.png" alt="" width={48} height={48} />
      <span className="kz-brand-copy">
        <strong>KARAM</strong>
        <span>
          {messages.en.common.portalSurface}
          {' · '}
          <span lang="ur" dir="rtl">
            {messages.ur.common.portalSurface}
          </span>
        </span>
      </span>
    </div>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function canAccessPortalPage(role: Role, pathname: string): boolean {
  if (isCurrent(pathname, '/notifications')) return isAirlineRole(role);
  const route = navigationGroups
    .flatMap((group) => group.links)
    .find((link) => isCurrent(pathname, link.href));
  return !route?.area || can(role, route.area, 'R');
}

function roleLabel(role: Role): string {
  if (isAirlineRole(role)) return AIRLINE_ROLE_LABELS[role];
  const words = role.toLowerCase().split('_');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
