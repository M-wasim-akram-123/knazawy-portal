'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { clearSession, readSessionUser } from '../lib/session';
import { canAccessStaffPath } from '../lib/staff-access';

import { NotificationBell } from './notifications/NotificationBell';

const navigationGroups: Array<{
  label: string;
  links: Array<{ href: string; label: string }>;
}> = [
  {
    label: 'Workspace',
    links: [{ href: '/', label: messages.en.common.today }],
  },
  {
    label: 'Supply & stock',
    links: [
      { href: '/purchases', label: messages.en.common.purchases },
      { href: '/bills', label: messages.en.common.scanBill },
      { href: '/store', label: messages.en.common.receiveGoods },
      { href: '/issues', label: messages.en.common.issueStock },
      { href: '/transfers', label: messages.en.common.transferStock },
      { href: '/counts', label: messages.en.common.countStock },
      { href: '/items', label: messages.en.common.items },
      { href: '/suppliers', label: messages.en.common.suppliers },
      { href: '/locations', label: messages.en.common.locations },
    ],
  },
  {
    label: 'Kitchen',
    links: [
      { href: '/recipes', label: messages.en.common.recipes },
      { href: '/production', label: messages.en.common.production },
      { href: '/meal-cost', label: messages.en.common.mealCost },
    ],
  },
  {
    label: 'Service & finance',
    links: [
      { href: '/requests', label: messages.en.common.requests },
      { href: '/deliveries', label: messages.en.common.deliveries },
      { href: '/rates', label: messages.en.common.rateCards },
      { href: '/airlines', label: messages.en.common.airlines },
      { href: '/invoices', label: messages.en.common.invoices },
      { href: '/room-requests', label: messages.en.common.roomRequests },
      { href: '/room-bills', label: messages.en.common.roomBills },
      { href: '/rooms', label: messages.en.common.rooms },
      { href: '/disputes', label: messages.en.common.disputes },
      { href: '/ledger', label: messages.en.common.ledger },
    ],
  },
];

export function StaffFrame({ children }: { children: ReactNode }) {
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
    if (session && !signingIn && !canAccessStaffPath(session.role, pathname)) router.replace('/');
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
  if (!canAccessStaffPath(user.role, pathname)) return <p className="kz-booting">Loading</p>;

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => canAccessStaffPath(user.role, link.href)),
    }))
    .filter((group) => group.links.length > 0);
  const activeLink = visibleGroups
    .flatMap((group) => group.links)
    .find((link) => isCurrent(pathname, link.href));

  return (
    <div className="kz-app">
      <header className="kz-topbar">
        <Brand />
        <div className="kz-header-context">
          <span>STAFF / OPERATIONS</span>
          <strong>{activeLink?.label ?? messages.en.common.today}</strong>
        </div>
        <div className="kz-top-user">
          <NotificationBell />
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
        <nav className="kz-side" aria-label="Staff">
          {visibleGroups.map((group) => (
            <div className="kz-nav-group" key={group.label}>
              <span className="kz-nav-label">{group.label}</span>
              {group.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
          <div className="kz-side-footer">
            <span className="kz-footer-dot" aria-hidden="true" />
            Staff workspace
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
        <span className="kz-brand-caption">RESTAURANT OPERATIONS</span>
        <span lang="ur" dir="rtl">
          {messages.ur.common.productName}
        </span>
      </span>
    </div>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role: string): string {
  const words = role.toLowerCase().split('_');
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
