const OUTCOMES = [
  { id: 'processed', title: 'Stored and counted once' },
  { id: 'duplicate', title: 'Seen before; totals unchanged' },
  { id: 'rejected', title: 'Malformed; retrying will not help' },
  { id: 'failed', title: 'Write rolled back; retrying is safe' },
];

/**
 * The ingestion counters are GLOBAL — they come from raw_events and ignore
 * the aggregate filters entirely. Showing them here, next to the connection
 * light, keeps that distinction visible; inside the aggregates panel they
 * looked like part of the filtered result, which they never were.
 */
export default function StatusBar({ offline, ingestion }) {
  const counts = ingestion ?? { processed: 0, duplicate: 0, rejected: 0, failed: 0 };
  const received = OUTCOMES.reduce((sum, o) => sum + (counts[o.id] ?? 0), 0);

  return (
    <div className={`statusbar ${offline ? 'statusbar--down' : ''}`}>
      <span className="statusbar__conn">
        <span className="statusbar__led" aria-hidden="true" />
        {offline ? 'API unreachable' : 'API connected'}
      </span>

      <span className="statusbar__conn">{received} received</span>

      <span className="statusbar__spacer" />

      <div className="statusbar__counters" aria-label="Ingestion outcomes">
        {OUTCOMES.map((outcome) => {
          const n = counts[outcome.id] ?? 0;
          return (
            <span
              key={outcome.id}
              className={`counter counter--${outcome.id} ${n > 0 ? 'counter--live' : ''}`}
              title={outcome.title}
            >
              <span className="counter__n">{n}</span>
              <span className="counter__k">{outcome.id}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
