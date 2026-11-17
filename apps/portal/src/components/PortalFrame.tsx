'use client';

import type { SessionUser } from '@knazawy/auth-client';
import type { CommonCopy, chromeCopy } from '@knazawy/i18n';
import { ROLE_LABELS, can, isAirlineRole, type Area, type Role } from '@knazawy/shared';
import { KaramLoader, LanguageSwitcher, LoadingOverlay, useLanguage } from '@knazawy/ui-shell';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { useChrome, useCommon, useLabel } from '../lib/i18n';
import { api, clearSession, readSessionUser } from '../lib/session';

import { NotificationBell } from './NotificationBell';

type Chrome = (typeof chromeCopy)['en'];

const navigationGroups: Array<{
  label: keyof Chrome;
  links: Array<{ href: string; label: keyof CommonCopy; area?: Area }>;
}> = [
  {
    label: 'portalOverview',
    links: [{ href: '/', label: 'home' }],
  },
  {
    label: 'portalServices',
    links: [
      { href: '/requests', label: 'requests', area: 'service_requests' },
      { href: '/room-requests', label: 'roomRequests', area: 'room_requests' },
      { href: '/deliveries', label: 'deliveries', area: 'distribution' },
      { href: '/rates', label: 'rateCards', area: 'service_rates' },
    ],
  },
  {
    label: 'portalFinance',
    links: [
      { href: '/invoices', label: 'invoices', area: 'invoices' },
      { href: '/disputes', label: 'disputes', area: 'disputes' },
      { href: '/ledger', label: 'ledger', area: 'ledger' },
    ],
  },
];

export function PortalFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const signingIn = pathname === '/login';
  const common = useCommon();
  const chrome = useChrome();
  const label = useLabel();
  const { dir } = useLanguage();

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
          <Brand surface={common.portalSurface} />
          <LanguageSwitcher label={chrome.language} />
        </header>
        <main className="kz-signin-main" dir={dir}>
          {children}
        </main>
        <LoadingOverlay subscribe={api.onActivity} label={chrome.loading} />
      </div>
    );
  }

  if (!ready || !user) return <KaramLoader label={chrome.loading} fullPage />;
  if (!canAccessPortalPage(user.role, pathname)) {
    return <p className="kz-booting">{chrome.notForYourRole}</p>;
  }

  const visibleGroups = navigationGroups
    .map((group) => ({
      key: group.label,
      label: chrome[group.label],
      links: group.links
        .filter((link) => !link.area || can(user.role, link.area, 'R'))
        .map((link) => ({ href: link.href, label: common[link.label] })),
    }))
    .filter((group) => group.links.length > 0);
  const activeLink = navigationGroups
    .flatMap((group) => group.links)
    .find((link) => isCurrent(pathname, link.href));

  return (
    <div className="kz-app">
      <header className="kz-topbar">
        <Brand surface={common.portalSurface} />
        <div className="kz-header-context">
          <span>{chrome.partnerContext}</span>
          <strong>{activeLink ? common[activeLink.label] : common.home}</strong>
        </div>
        <div className="kz-top-user">
          <LanguageSwitcher label={chrome.language} />
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
            <span>{label(ROLE_LABELS[user.role])}</span>
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
            {common.signOut}
          </button>
        </div>
      </header>
      <div className="kz-body">
        <nav className="kz-side" dir={dir} aria-label={chrome.portalNav}>
          {visibleGroups.map((group) => (
            <div className="kz-nav-group" key={group.key}>
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
            {chrome.partnerFooter}
          </div>
        </nav>
        <main className="kz-content" dir={dir}>
          {children}
        </main>
        <LoadingOverlay subscribe={api.onActivity} label={chrome.loading} />
      </div>
    </div>
  );
}

function Brand({ surface }: { surface: string }) {
  return (
    <div className="kz-brand">
      <Image className="kz-brand-logo" src="/karam-dome-mark.png" alt="" width={48} height={48} />
      <span className="kz-brand-copy">
        <strong>KARAM</strong>
        <span>{surface}</span>
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
