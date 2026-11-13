import { messages } from '@knazawy/i18n';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, statusTone } from '@knazawy/shared';

import { ApiStatus } from '../components/ApiStatus';

export default function HomePage() {
  return (
    <section className="kz-hero">
      <p>
        Airlines submit a flight, a passenger count, and a meal or snack. Hotel rooms join in
        Phase 2. The count that is billed is the count that was delivered.
      </p>
      <a className="kz-button" href="/requests">
        {messages.en.common.newRequest}
      </a>
      <p lang="ur" dir="rtl">
        {messages.ur.common.newRequest}
      </p>
      <ul className="kz-status-list">
        {REQUEST_STATUSES.map((status) => (
          <li key={status} className={`kz-tone-${statusTone(status)}`}>
            {REQUEST_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
      <ApiStatus />
    </section>
  );
}
