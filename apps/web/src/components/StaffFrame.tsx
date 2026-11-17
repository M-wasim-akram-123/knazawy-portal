'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { ROLE_LABELS } from '@knazawy/shared';
import { KaramLoader, LanguageSwitcher, LoadingOverlay, useLanguage } from '@knazawy/ui-shell';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { fill, useChrome, useCommon, useLabel } from '../lib/i18n';
import { api, clearSession, readSessionUser } from '../lib/session';
import { canAccessStaffPath } from '../lib/staff-access';
import { navigationFor, workspaceName } from '../lib/workspaces';

import { NotificationBell } from './notifications/NotificationBell';

export function StaffFrame({ children }: { children: ReactNode }) {
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
    if (session && !signingIn && !canAccessStaffPath(session.role, pathname)) router.replace('/');
  }, [pathname, router, signingIn]);

  if (signingIn) {
    return (
      <div className="kz-signin">
        <header className="kz-topbar">
          <Brand caption={chrome.brandStaff} productName={common.productName} />
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
  if (!canAccessStaffPath(user.role, pathname)) {
    return <KaramLoader label={chrome.loading} fullPage />;
  }

  const visibleGroups = navigationFor(user.role, common);
  const workspace = workspaceName(user.role, chrome);
  const activeLink = visibleGroups
    .flatMap((group) => group.links)
    .find((link) => isCurrent(pathname, link.href));

  return (
    <div className="kz-app">
      <header className="kz-topbar">
        <Brand caption={chrome.brandStaff} productName={common.productName} />
        <div className="kz-header-context">
          <span>
            {chrome.staffContext} / {workspace.toUpperCase()}
          </span>
          <strong>{activeLink?.label ?? common.today}</strong>
        </div>
        <div className="kz-top-user">
          <LanguageSwitcher label={chrome.language} />
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
        <nav className="kz-side" dir={dir} aria-label={chrome.staffNav}>
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
            {fill(chrome.workspaceFooter, { name: workspace })}
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

function Brand({ caption, productName }: { caption: string; productName: string }) {
  return (
    <div className="kz-brand">
      <Image className="kz-brand-logo" src="/karam-dome-mark.png" alt="" width={48} height={48} />
      <span className="kz-brand-copy">
        <strong>KARAM</strong>
        <span className="kz-brand-caption">{caption}</span>
        <span>{productName}</span>
      </span>
    </div>
  );
}

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
