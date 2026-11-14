'use client';

import type { SessionUser } from '@knazawy/auth-client';
import { messages } from '@knazawy/i18n';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { clearSession, readSessionUser } from '../lib/session';

const links = [
  { href: '/', label: messages.en.common.today },
  { href: '/purchases', label: messages.en.common.purchases },
  { href: '/bills', label: messages.en.common.scanBill },
  { href: '/store', label: messages.en.common.receiveGoods },
  { href: '/issues', label: messages.en.common.issueStock },
  { href: '/transfers', label: messages.en.common.transferStock },
  { href: '/counts', label: messages.en.common.countStock },
  { href: '/recipes', label: messages.en.common.recipes },
  { href: '/production', label: messages.en.common.production },
  { href: '/meal-cost', label: messages.en.common.mealCost },
  { href: '/items', label: messages.en.common.items },
  { href: '/suppliers', label: messages.en.common.suppliers },
  { href: '/locations', label: messages.en.common.locations },
  { href: '/airlines', label: messages.en.common.airlines },
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
        <nav className="kz-side" aria-label="Staff">
          {links.map((link) => (
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
      <span lang="ur" dir="rtl">
        {messages.ur.common.productName}
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
