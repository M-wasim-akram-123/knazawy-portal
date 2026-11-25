/** Most people icons drawn for one room. A bigger room shows a number instead. */
const MOST_PIPS = 8;

/** One small person per place in a room, dark where a guest is, light where it is free. */
export function Pips({ capacity, filled }: { capacity: number; filled: number }) {
  if (capacity > MOST_PIPS) {
    return (
      <span className="kz-rb-pips" aria-hidden="true">
        <Person on={filled > 0} />
        <b>
          {filled}/{capacity}
        </b>
      </span>
    );
  }
  return (
    <span className="kz-rb-pips" aria-hidden="true">
      {Array.from({ length: capacity }, (_, index) => (
        <Person key={index} on={index < filled} />
      ))}
    </span>
  );
}

function Person({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 12 16"
      width="11"
      height="14"
      className={on ? 'kz-rb-pip kz-rb-pip-on' : 'kz-rb-pip'}
    >
      <circle cx="6" cy="4" r="3" />
      <path d="M0 16c0-4 2.5-6 6-6s6 2 6 6z" />
    </svg>
  );
}
