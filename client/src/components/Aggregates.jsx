const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const GROUPS = [
  { id: 'client_id', label: 'Client' },
  { id: 'metric', label: 'Metric' },
];

function shortDate(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export default function Aggregates({
  data,
  loading,
  filters,
  groupBy,
  onGroupByChange,
  onFilterChange,
  onReset,
}) {
  const totals = data?.totals;
  const groups = data?.groups ?? [];
  // Bars are scaled against the largest group, not the overall total, so a
  // single dominant client does not flatten everything else to a hairline.
  const max = groups.reduce((m, g) => Math.max(m, Math.abs(g.total_amount)), 0);
  const dirty = filters.client_id || filters.fromDate || filters.toDate;

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Aggregates</h2>
          <p className="panel__sub">Recalculated from stored events on every request.</p>
        </div>
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
        <button
          type="button"
          className="btn btn--quiet"
          onClick={onReset}
          disabled={!dirty}
        >
          Clear
        </button>
      </div>

      {loading ? (
        <div className="skeleton skeleton--readout" />
      ) : (
        <div className="readout">
          <div>
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
              <span className="readout__small">
                {NUMBER.format(totals?.average_amount ?? 0)}
              </span>
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
      )}

      <div className="breakdown">
        <div className="breakdown__head">
          <span className="breakdown__title">Breakdown</span>
          <div className="segmented" role="group" aria-label="Group results by">
            {GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                className="segmented__opt"
                aria-pressed={groupBy === group.id}
                onClick={() => onGroupByChange(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="skeleton skeleton--rows" />
        ) : groups.length === 0 ? (
          <p className="empty">
            {dirty
              ? 'No events match these filters.'
              : 'Nothing aggregated yet. Send an event to populate the totals.'}
          </p>
        ) : (
          <div className="bars">
            {groups.map((group) => (
              <div className="bar" key={group.group_key}>
                <span className="bar__label" title={group.group_key}>
                  {group.group_key}
                </span>
                <span className="bar__meta">
                  <span className="bar__value">{NUMBER.format(group.total_amount)}</span>
                  <span className="bar__count">
                    {group.event_count} {group.event_count === 1 ? 'event' : 'events'}
                  </span>
                </span>
                <span className="bar__track">
                  <span
                    className="bar__fill"
                    style={{
                      width: max ? `${Math.max((Math.abs(group.total_amount) / max) * 100, 2)}%` : '2%',
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
