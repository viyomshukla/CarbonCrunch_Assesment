import { useMemo, useState } from 'react';

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
    bad: true,
    body: { source: 'client_D', payload: { metric: 'value', amount: 'abc' } },
  },
];

const INITIAL = JSON.stringify(PRESETS[0].body, null, 2);

export default function EventForm({ onSubmit, busy }) {
  const [text, setText] = useState(INITIAL);
  const [activePreset, setActivePreset] = useState(PRESETS[0].id);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Parsed on every keystroke purely to light the validity flag. The server
  // validates independently and does not trust any of this.
  const parsed = useMemo(() => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }, [text]);

  function loadPreset(preset) {
    setText(JSON.stringify(preset.body, null, 2));
    setActivePreset(preset.id);
    setLocalError(null);
  }

  function handleChange(value) {
    setText(value);
    setActivePreset(null);
    if (localError) setLocalError(null);
  }

  function format() {
    if (!parsed.ok) {
      setLocalError('Cannot reformat: the body is not valid JSON yet.');
      return;
    }
    setText(JSON.stringify(parsed.value, null, 2));
    setLocalError(null);
  }

  function handleSubmit() {
    if (!parsed.ok) {
      setLocalError(`That is not valid JSON — ${parsed.message}`);
      return;
    }
    setLocalError(null);
    onSubmit(text, { simulateFailure });
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Submit raw event</h2>
          <p className="panel__sub">Any shape. The server decides what it can use.</p>
        </div>
      </div>

      <div className="presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`preset ${preset.bad ? 'preset--bad' : ''} ${
              activePreset === preset.id ? 'preset--on' : ''
            }`}
            onClick={() => loadPreset(preset)}
          >
            <span className="preset__label">{preset.label}</span>
            <span className="preset__hint">{preset.hint}</span>
          </button>
        ))}
      </div>

      <label className="field">
        <span className="field__label">Request body</span>
        <span className="editorwrap">
          <textarea
            className={`editor ${parsed.ok ? '' : 'editor--bad'}`}
            value={text}
            spellCheck="false"
            rows={12}
            onChange={(e) => handleChange(e.target.value)}
          />
          <span
            className={`editorwrap__flag ${parsed.ok ? '' : 'editorwrap__flag--bad'}`}
            aria-hidden="true"
          >
            {parsed.ok ? 'valid json' : 'invalid json'}
          </span>
        </span>
      </label>

      {localError && <p className="inline-error">{localError}</p>}

      <label className={`switch ${simulateFailure ? 'switch--on' : ''}`}>
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
          {busy && <span className="spinner" aria-hidden="true" />}
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
        <button type="button" className="btn btn--quiet" onClick={format} disabled={busy}>
          Reformat
        </button>
      </div>

      <p className="hint">
        Send the same body twice to see deduplication. Turn on failure, send, then send
        again with it off to see a rolled-back write recover.
      </p>
    </section>
  );
}
