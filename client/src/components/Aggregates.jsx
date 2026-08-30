const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function shortDate(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export default function Aggregates({ data, filters, onFilterChange, onReset }) {
  const totals = data?.totals;
  const groups = data?.groups ?? [];
  const ingestion = data?.ingestion;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Aggregates</h2>
        <p className="panel__sub">Recalculated from stored events on every request.</p>
      </div>

      <div className="filters">
        <label className="field field--inline">
          <span className="field__label">Client</span>
          <input
            type="text"
            placeholder="all clients"
            value={filters.client_id}
            onChange={(e) => onFilterChange('client_id', e.target.value)}
          />
        </label>
        <label className="field field--inline">
          <span className="field__label">From</span>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => onFilterChange('fromDate', e.target.value)}
          />
        </label>
        <label className="field field--inline">
          <span className="field__label">To</span>
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => onFilterChange('toDate', e.target.value)}
          />
        </label>
        <button type="button" className="btn btn--quiet" onClick={onReset}>
          Clear
        </button>
      </div>

      <div className="readout">
        <div className="readout__primary">
          <span className="readout__label">Total amount</span>
          <span className="readout__value">{NUMBER.format(totals?.total_amount ?? 0)}</span>
        </div>
        <div className="readout__grid">
          <div>
            <span className="readout__label">Events</span>
            <span className="readout__small">{totals?.event_count ?? 0}</span>
          </div>
          <div>
            <span className="readout__label">Average</span>
            <span className="readout__small">{NUMBER.format(totals?.average_amount ?? 0)}</span>
          </div>
          <div>
            <span className="readout__label">Earliest</span>
            <span className="readout__small">{shortDate(totals?.earliest)}</span>
          </div>
          <div>
            <span className="readout__label">Latest</span>
            <span className="readout__small">{shortDate(totals?.latest)}</span>
          </div>
        </div>
      </div>

      {groups.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>Client</th>
              <th className="num">Events</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.group_key}>
                <td className="mono">{group.group_key}</td>
                <td className="num">{group.event_count}</td>
                <td className="num mono">{NUMBER.format(group.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {groups.length === 0 && (
        <p className="empty">No events match these filters yet.</p>
      )}

      {ingestion && (
        <div className="counters">
          <span className="counters__title">Ingestion log</span>
          {['processed', 'duplicate', 'rejected', 'failed'].map((key) => (
            <span key={key} className={`counter counter--${key}`}>
              <span className="counter__n">{ingestion[key] ?? 0}</span>
              <span className="counter__k">{key}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}