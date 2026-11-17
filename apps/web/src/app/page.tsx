'use client';

import { staffHomeCopy } from '@knazawy/i18n';
import type { Role } from '@knazawy/shared';
import { KaramLoader } from '@knazawy/ui-shell';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiStatus } from '../components/ApiStatus';
import { fill, useChrome, useCommon, useCopy } from '../lib/i18n';
import { readSessionUser } from '../lib/session';
import { stepsFor, workspaceName } from '../lib/workspaces';

export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);
  const chrome = useChrome();
  const common = useCommon();
  const t = useCopy(staffHomeCopy);

  useEffect(() => {
    setRole(readSessionUser()?.role ?? null);
  }, []);

  if (!role) return <KaramLoader label={chrome.loading} fullPage />;
  const steps = stepsFor(role, chrome);

  return (
    <div className="kz-dashboard">
      <header className="kz-dashboard-hero">
        <div className="kz-dashboard-hero-copy">
          <p className="kz-eyebrow">Karam / {workspaceName(role, chrome)}</p>
          <h1>
            {t.heroLine1}
            <br />
            {t.heroLine2}
          </h1>
          <p className="kz-dashboard-intro">{t.intro}</p>
          <div className="kz-dashboard-actions">
            {steps.slice(0, 2).map((step, index) => (
              <Link
                className={index === 0 ? 'kz-button' : 'kz-button kz-button-outline'}
                href={step.href}
                key={step.href}
              >
                {step.title}
              </Link>
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
              <span>{t.liveConnection}</span>
              <ApiStatus />
            </div>
          </div>
          <span className="kz-visual-caption">{t.caption}</span>
        </div>
      </header>

      <section className="kz-dashboard-section" aria-labelledby="your-work-title">
        <div className="kz-section-heading">
          <div>
            <h2 id="your-work-title">{common.yourWork}</h2>
            <p>{t.stepsIntro}</p>
          </div>
        </div>
        <div className="kz-quick-grid">
          {steps.map((step, index) => (
            <Link className="kz-quick-card" href={step.href} key={step.href}>
              <span className="kz-quick-card-top">
                <span className="kz-quick-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="kz-quick-category">{fill(t.step, { number: index + 1 })}</span>
              </span>
              <span className="kz-quick-title">{step.title}</span>
              <span className="kz-quick-description">{step.description}</span>
              <span className="kz-quick-arrow" aria-hidden="true">
                &gt;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
