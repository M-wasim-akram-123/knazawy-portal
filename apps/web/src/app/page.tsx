'use client';

import { messages } from '@knazawy/i18n';
import type { Role } from '@knazawy/shared';
import { useEffect, useState } from 'react';

import { ApiStatus } from '../components/ApiStatus';
import { readSessionUser } from '../lib/session';
import { canAccessStaffPath } from '../lib/staff-access';

const heroActions = [
  { href: '/requests', label: 'Open service requests', className: 'kz-button' },
  { href: '/bills', label: messages.en.common.scanBill, className: 'kz-button kz-button-outline' },
] as const;

const quickActions = [
  {
    href: '/bills',
    number: '01',
    category: 'Procurement',
    title: messages.en.common.scanBill,
    description: 'Record a supplier bill and prepare received goods for stock.',
  },
  {
    href: '/store',
    number: '02',
    category: 'Inventory',
    title: messages.en.common.receiveGoods,
    description: 'Receive a purchase and add its goods to the stock ledger.',
  },
  {
    href: '/requests',
    number: '03',
    category: 'Airline service',
    title: messages.en.common.requests,
    description: 'Review meal and snack requests from airline partners.',
  },
  {
    href: '/deliveries',
    number: '04',
    category: 'Distribution',
    title: messages.en.common.deliveries,
    description: 'Prepare deliveries and follow handoff to the airline.',
  },
] as const;

const workAreas = [
  {
    href: '/purchases',
    title: 'Purchasing & suppliers',
    description: 'Manage purchases, supplier bills, and goods received.',
  },
  {
    href: '/items',
    title: 'Stock & locations',
    description: 'Keep item records, stock locations, and movements in order.',
  },
  {
    href: '/recipes',
    title: 'Kitchen & costing',
    description: 'Maintain recipes, production batches, and meal costs.',
  },
  {
    href: '/invoices',
    title: 'Finance',
    description: 'Review invoices, disputes, and posted ledger entries.',
  },
] as const;

export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    setRole(readSessionUser()?.role ?? null);
  }, []);

  if (!role) return <p className="kz-booting">Loading</p>;

  return (
    <div className="kz-dashboard">
      <header className="kz-dashboard-hero">
        <div className="kz-dashboard-hero-copy">
          <p className="kz-eyebrow">Karam / Operations</p>
          <h1>
            Kitchen to cabin,
            <br />
            everything in sync.
          </h1>
          <p className="kz-dashboard-intro">
            Keep the store, kitchen, service, and finance teams moving together.
          </p>
          <div className="kz-dashboard-actions">
            {heroActions
              .filter((action) => canAccessStaffPath(role, action.href))
              .map((action) => (
                <a className={action.className} href={action.href} key={action.href}>
                  {action.label}
                </a>
              ))}
          </div>
        </div>
        <div className="kz-dashboard-visual">
          <svg className="kz-plate-art" viewBox="0 0 360 360" aria-hidden="true">
            <circle cx="180" cy="180" r="151" fill="none" stroke="rgba(255,255,255,.16)" />
            <circle cx="180" cy="180" r="126" fill="#f3e7d1" />
            <circle cx="180" cy="180" r="111" fill="#fffaf0" />
            <circle cx="180" cy="180" r="77" fill="#f3d9ae" />
            <path
              d="M124 197c25-44 66-59 111-43-13 42-49 72-93 72-12 0-22-9-18-29Z"
              fill="#357451"
            />
            <path d="M132 218c29-32 58-49 96-63" fill="none" stroke="#d4e4ad" strokeWidth="5" />
            <circle cx="151" cy="156" r="15" fill="#d85d37" />
            <circle cx="210" cy="221" r="12" fill="#d85d37" />
            <circle cx="207" cy="153" r="7" fill="#f1ae42" />
            <circle cx="162" cy="233" r="6" fill="#f1ae42" />
            <path d="M174 115c-5-27 4-42 22-49 8 18 2 34-22 49Z" fill="#5f8c50" />
            <path d="M184 116c13-23 29-29 46-22-5 18-21 27-46 22Z" fill="#82a75c" />
          </svg>
          <div className="kz-dashboard-health">
            <div>
              <span>Live connection</span>
              <ApiStatus />
            </div>
          </div>
          <span className="kz-visual-caption">Fresh work. Clear handoffs.</span>
        </div>
      </header>

      <section className="kz-dashboard-section" aria-labelledby="quick-actions-title">
        <div className="kz-section-heading">
          <div>
            <h2 id="quick-actions-title">Quick actions</h2>
            <p>Pick up a common task and keep operations moving.</p>
          </div>
        </div>
        <div className="kz-quick-grid">
          {quickActions
            .filter((action) => canAccessStaffPath(role, action.href))
            .map((action) => (
              <a className="kz-quick-card" href={action.href} key={action.href}>
                <span className="kz-quick-card-top">
                  <span className="kz-quick-number">{action.number}</span>
                  <span className="kz-quick-category">{action.category}</span>
                </span>
                <span className="kz-quick-title">{action.title}</span>
                <span className="kz-quick-description">{action.description}</span>
                <span className="kz-quick-arrow" aria-hidden="true">
                  &gt;
                </span>
              </a>
            ))}
        </div>
      </section>

      <section className="kz-dashboard-section" aria-labelledby="work-areas-title">
        <div className="kz-section-heading">
          <div>
            <h2 id="work-areas-title">Work areas</h2>
            <p>Go directly to the tools your team uses every day.</p>
          </div>
        </div>
        <div className="kz-work-area-grid">
          {workAreas
            .filter((area) => canAccessStaffPath(role, area.href))
            .map((area) => (
              <a className="kz-work-area-card" href={area.href} key={area.href}>
                <span className="kz-work-area-arrow" aria-hidden="true">
                  &gt;
                </span>
                <h3>{area.title}</h3>
                <p>{area.description}</p>
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
