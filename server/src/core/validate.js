import { toTimestamp } from './coerce.js';

/**
 * VALIDATION. Strict on purpose, and deliberately separate from normalisation.
 *
 * Rule of thumb applied here: reject anything that would corrupt an
 * aggregate, accept anything that is merely unusual.
 *
 * A missing amount is fatal — SUM() over a null is meaningless.
 * An unknown extra field is not fatal — it affects nothing downstream.
 *
 * Returns every problem at once. A client fixing one field at a time,
 * discovering a new error on each retry, is a miserable integration.
 */

// Guard against a bad parse producing an absurd date. Events far outside a
// plausible window usually mean the source format was misread (e.g. seconds
// read as milliseconds), and silently accepting them poisons time filters.
const MIN_TS = Date.UTC(2000, 0, 1);
const MAX_TS = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year ahead

export function validate(canonical, meta = {}) {
  const errors = [];

  if (meta.shapeError) errors.push(meta.shapeError);

  if (!canonical.client_id) {
    errors.push('client_id is missing (looked for: source, client, client_id, src)');
  }

  if (!canonical.metric) {
    errors.push('metric is missing (looked for: metric, type, kind, name)');
  }

  if (canonical.amount === null) {
    const rawAmount = meta.rawValues?.amount;
    errors.push(
      rawAmount === undefined
        ? 'amount is missing (looked for: amount, total, amt, value)'
        : `amount is not a number: ${JSON.stringify(rawAmount)}`
    );
  } else if (!Number.isFinite(canonical.amount)) {
    errors.push('amount is not finite');
  }

  if (canonical.timestamp === null) {
    const rawTs = meta.rawValues?.timestamp;
    errors.push(
      rawTs === undefined
        ? 'timestamp is missing (looked for: timestamp, date, time, ts)'
        : `timestamp is unparseable: ${JSON.stringify(rawTs)}`
    );
  } else {
    const ms = new Date(canonical.timestamp).getTime();
    if (ms < MIN_TS || ms > MAX_TS) {
      errors.push(`timestamp ${canonical.timestamp} is outside the plausible range`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Exported so tests and the UI can show what the rules are without
 * duplicating them.
 */
export const REQUIRED_FIELDS = ['client_id', 'metric', 'amount', 'timestamp'];
export { toTimestamp };