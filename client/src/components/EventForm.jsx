import { useState } from 'react';

/**
 * Presets exist so a reviewer can reproduce every behaviour in the system
 * without inventing payloads. Each one demonstrates a specific claim from the
 * design: alias mapping, type coercion, unknown fields, and rejection.
 */
const PRESETS = [
  {
    id: 'a',
    label: 'client_A',
    hint: 'nested payload, amount as text',
    body: {
      source: 'client_A',
      payload: { metric: 'value', amount: '1200', timestamp: '2024/01/01' },
    },
  },
  {
    id: 'b',
    label: 'client_B',
    hint: 'different field names, flat',
    body: { client: 'client_B', type: 'value', total: 1200, date: '01-01-2024' },
  },
  {
    id: 'c',
    label: 'client_C',
    hint: 'unix time, comma amount, extra field',
    body: {
      src: 'client_C',
      data: { kind: 'value', amt: '1,200.00', ts: 1704067200, region: 'north' },
    },
  },
  {
    id: 'bad',
    label: 'malformed',
    hint: 'unusable amount, no timestamp',
    body: { source: 'client_D', payload: { metric: 'value', amount: 'abc' } },
  },
];

const INITIAL = JSON.stringify(PRESETS[0].body, null, 2);

export default function EventForm({ onSubmit, busy }) {
  const [text, setText] = useState(INITIAL);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [localError, setLocalError] = useState(null);

  function loadPreset(preset) {
    setText(JSON.stringify(preset.body, null, 2));
    setLocalError(null);
  }

  function handleSubmit() {
    // Parsed here purely to catch typos before a round trip. The server
    // validates independently and does not trust this.
    try {
      JSON.parse(text);
    } catch {
      setLocalError('That is not valid JSON. Check for a missing comma or quote.');
      return;
    }
    setLocalError(null);
    onSubmit(text, { simulateFailure });
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Submit raw event</h2>
        <p className="panel__sub">Any shape. The server decides what it can use.</p>
      </div>

      <div className="presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset"
            onClick={() => loadPreset(preset)}
          >
            <span className="preset__label">{preset.label}</span>
            <span className="preset__hint">{preset.hint}</span>
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field__label">Request body</span>
        <textarea
          className="editor"
          value={text}
          spellCheck="false"
          rows={12}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      {localError && <p className="inline-error">{localError}</p>}

      <label className="switch">
        <input
          type="checkbox"
          checked={simulateFailure}
          onChange={(e) => setSimulateFailure(e.target.checked)}
        />
        <span className="switch__track" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
        <span className="switch__text">
          <strong>Simulate database failure</strong>
          <span>Throws mid-transaction, after the write is staged</span>
        </span>
      </label>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={busy}>
          {busy ? 'Sending…' : 'Send event'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleSubmit}
          disabled={busy}
          title="Sends the exact same body again, the way a retrying client would"
        >
          Send again
        </button>
      </div>

      <p className="hint">
        Send the same body twice to see deduplication. Turn on failure, send, then send
        again with it off to see a rolled-back write recover.
      </p>
    </section>
  );
}