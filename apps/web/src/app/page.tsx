import { messages } from '@knazawy/i18n';
import { MODULES } from '@knazawy/shared';

import { ApiStatus } from '../components/ApiStatus';

export default function HomePage() {
  return (
    <>
      <section className="kz-hero">
        <p>
          Phase 1A starts in the store. Kitchen production, airline requests, and finance stay on
          the same record.
        </p>
        <a className="kz-button" href="/store">
          {messages.en.common.receiveGoods}
        </a>
        <p lang="ur" dir="rtl">
          {messages.ur.common.receiveGoods}
        </p>
        <ApiStatus />
      </section>
      <ul className="kz-grid">
        {MODULES.map((module) => (
          <li key={module.id} className="kz-card">
            <span className="kz-phase">Phase {module.phase}</span>
            <h2>{module.title}</h2>
            <p>{module.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
