import { useState } from 'react';

const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const TABS = [
  { id: 'processed', label: 'Stored' },
  { id: 'problem', label: 'Rejected & failed' },
  { id: 'all', label: 'Everything received' },
];

function StoredRows({ events }) {
  if (events.length === 0) {
    return <p className="empty">Nothing stored yet. Send an event to begin.</p>;
  }
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>#</th>
          <th>Client</th>
          <th>Metric</th>
          <th className="num">Amount</th>
          <th>Timestamp</th>
          <th>Key</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td className="mono dim">{event.id}</td>
            <td className="mono">{event.client_id}</td>
            <td>{event.metric}</td>
            <td className="num mono">{NUMBER.format(event.amount)}</td>
            <td className="mono dim">{event.timestamp.replace('T', ' ').slice(0, 19)}</td>
            <td className="mono dim">{event.fingerprint.slice(0, 8)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RawRows({ rows, emptyText }) {
  if (rows.length === 0) return <p className="empty">{emptyText}</p>;
  return (
    <ul className="log">
      {rows.map((row) => (
        <li key={row.id} className={`log__item log__item--${row.status}`}>
          <div className="log__meta">
            <span className={`tag tag--${row.status}`}>{row.status}</span>
            <span className="log__id">#{row.id}</span>
            <span className="log__time">{row.received_at}</span>
          </div>
          {row.reason && <p className="log__reason">{row.reason}</p>}
          <pre className="log__body">{JSON.stringify(row.raw, null, 2)}</pre>
        </li>
      ))}
    </ul>
  );
}

export default function EventsTable({ events, rawEvents }) {
  const [tab, setTab] = useState('processed');

  const problems = rawEvents.filter(
    (row) => row.status === 'rejected' || row.status === 'failed'
  );

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Records</h2>
        <p className="panel__sub">
          Raw bodies are kept whatever the outcome, so a rejection is always explainable.
        </p>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={tab === entry.id}
            className={`tab ${tab === entry.id ? 'tab--on' : ''}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            <span className="tab__count">
              {entry.id === 'processed'
                ? events.length
                : entry.id === 'problem'
                  ? problems.length
                  : rawEvents.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'processed' && <StoredRows events={events} />}
      {tab === 'problem' && (
        <RawRows
          rows={problems}
          emptyText="No rejections or failures. Try the malformed preset, or turn on failure simulation."
        />
      )}
      {tab === 'all' && (
        <RawRows rows={rawEvents} emptyText="Nothing received yet." />
      )}
    </section>
  );
}