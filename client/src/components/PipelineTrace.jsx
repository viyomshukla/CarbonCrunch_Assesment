/**
 * The four stages every event passes through, in order. Showing where an
 * event stopped is more useful than showing a pass/fail badge, because the
 * stopping point IS the explanation: rejected at validate means bad data,
 * halted at fingerprint means the client resent something, failed at commit
 * means the write rolled back and a retry will work.
 */
const STAGES = [
  { key: 'normalise',   label: 'Normalise',   note: 'Map fields, coerce types' },
  { key: 'validate',    label: 'Validate',    note: 'Check required values' },
  { key: 'fingerprint', label: 'Fingerprint', note: 'Derive dedup key' },
  { key: 'commit',      label: 'Commit',      note: 'Write in one transaction' },
];

/**
 * Translate a backend outcome into per-stage states.
 * 'pass' cleared it, 'stop' is where it ended, 'idle' was never reached.
 */
function stageStates(status) {
  switch (status) {
    case 'processed':
      return { normalise: 'pass', validate: 'pass', fingerprint: 'pass', commit: 'pass' };
    case 'rejected':
      return { normalise: 'pass', validate: 'stop', fingerprint: 'idle', commit: 'idle' };
    case 'duplicate':
      return { normalise: 'pass', validate: 'pass', fingerprint: 'stop', commit: 'idle' };
    case 'failed':
      return { normalise: 'pass', validate: 'pass', fingerprint: 'pass', commit: 'stop' };
    default:
      return { normalise: 'idle', validate: 'idle', fingerprint: 'idle', commit: 'idle' };
  }
}

const OUTCOME_COPY = {
  processed: 'Stored. Counted once in the totals.',
  duplicate: 'Already on record. The totals did not change.',
  rejected: 'Not stored. Resending the same body will not help.',
  failed: 'Rolled back. Nothing was written, so resending is safe.',
};

// A processed event stops nowhere — it clears the last stage — so the colour
// it carries is the one for a completed run.
const STOP_STAGE = {
  processed: 'commit',
  duplicate: 'fingerprint',
  rejected: 'validate',
  failed: 'commit',
};

export default function PipelineTrace({ result, live }) {
  const status = result?.status;
  const states = stageStates(status);
  const httpStatus = result?.httpStatus;

  return (
    <section
      className={`trace ${status ? `trace--${status}` : ''} ${live ? 'trace--live' : ''}`}
      aria-live="polite"
    >
      <div className="trace__header">
        <h2 className="panel__title">Pipeline</h2>
        {status && (
          <span className={`tag tag--${status}`}>
            {status}
            {httpStatus ? ` · ${httpStatus}` : ''}
          </span>
        )}
      </div>

      <ol className="trace__track">
        {STAGES.map((stage) => (
          <li key={stage.key} className={`stage stage--${states[stage.key]}`}>
            <span className="stage__dot" aria-hidden="true" />
            <span className="stage__label">{stage.label}</span>
            <span className="stage__note">
              {status && STOP_STAGE[status] === stage.key ? 'ended here' : stage.note}
            </span>
          </li>
        ))}
      </ol>

      {!status && (
        <p className="trace__idle">Submit an event to trace it through the pipeline.</p>
      )}

      {status && (
        <div className="trace__outcome">
          <p className="trace__verdict">
            <span>{OUTCOME_COPY[status]}</span>
          </p>

          {result.errors?.length > 0 && (
            <ul className="trace__errors">
              {result.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}

          {result.error && <p className="trace__errorline">{result.error}</p>}

          {result.fingerprint && (
            <p className="trace__fingerprint">
              <span className="trace__fplabel">key</span>
              <code>{result.fingerprint.slice(0, 32)}</code>
            </p>
          )}

          {result.canonical && status !== 'rejected' && (
            <dl className="canonical">
              {Object.entries(result.canonical).map(([key, value]) => (
                <div className="canonical__row" key={key}>
                  <dt>{key}</dt>
                  <dd>{value === null ? '—' : String(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {result.unmapped?.length > 0 && (
            <p className="trace__unmapped">
              Kept in the raw record but not mapped:{' '}
              {result.unmapped.map((field, i) => (
                <span key={field}>
                  {i > 0 && ', '}
                  <code>{field}</code>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
