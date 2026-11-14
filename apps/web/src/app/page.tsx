import { messages } from '@knazawy/i18n';
import { MODULES } from '@knazawy/shared';

import { ApiStatus } from '../components/ApiStatus';

export default function HomePage() {
  return (
    <>
      <section className="kz-page-head">
        <h1>{messages.en.common.today}</h1>
        <p>
          Scan a supplier bill to put goods into stock. Purchases and the item list sit in the
          side navigation.
        </p>
        <a className="kz-button" href="/bills">
          {messages.en.common.scanBill}
        </a>
        <p lang="ur" dir="rtl">
          {messages.ur.common.purchases}
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
