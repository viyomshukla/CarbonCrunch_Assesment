import { db } from '../db.js';
import { normalize } from '../core/normalize.js';
import { validate } from '../core/validate.js';
import { fingerprintOf, extractExplicitId } from '../core/fingerprint.js';

/**
 * THE INGESTION PIPELINE, and the answer to "what happens if the database
 * fails mid-request?".
 *
 * Order of operations is deliberate:
 *
 *   normalise -> validate -> fingerprint -> write (all-or-nothing)
 *
 * Fingerprinting happens AFTER normalisation so that a client which sends
 * "1200" on the first attempt and 1200 on the retry still produces one
 * identical key. Hashing the raw body would let formatting drift defeat
 * deduplication entirely.
 */

const insertRaw = db.prepare(
  `INSERT INTO raw_events (raw_json, status, reason) VALUES (?, ?, ?)`
);

const setRawStatus = db.prepare(
  `UPDATE raw_events SET status = ?, reason = ? WHERE id = ?`
);

/**
 * ON CONFLICT DO NOTHING is what actually prevents double counting.
 *
 * We deliberately do NOT do "SELECT to check, then INSERT". Those are two
 * separate statements, and two concurrent retries can both pass the SELECT
 * before either INSERT lands — so both write, and the total doubles. The
 * UNIQUE constraint on fingerprint is enforced by the database itself and
 * has no such gap. The constraint is the guarantee; this code just reports
 * what the database decided.
 */
const insertEvent = db.prepare(`
  INSERT INTO events (fingerprint, raw_event_id, client_id, metric, amount, timestamp)
  VALUES (@fingerprint, @raw_event_id, @client_id, @metric, @amount, @timestamp)
  ON CONFLICT (fingerprint) DO NOTHING
`);

const findByFingerprint = db.prepare(`SELECT * FROM events WHERE fingerprint = ?`);

/**
 * Everything inside this function is ONE SQLite transaction. better-sqlite3
 * commits when it returns and rolls back if it throws. There is no state in
 * between: either the raw record and the canonical event are both durable,
 * or neither exists.
 */
const runIngest = db.transaction((raw, opts) => {
  const rawJson = JSON.stringify(raw);

  // Provisional status; corrected before the transaction ends.
  const rawId = insertRaw.run(rawJson, 'failed', null).lastInsertRowid;

  const { canonical, meta } = normalize(raw);
  const { ok, errors } = validate(canonical, meta);

  if (!ok) {
    // A rejected event is a SUCCESSFUL outcome of the pipeline, not a crash.
    // We commit it so the client gets a permanent answer and stops retrying,
    // and so the raw body is kept for inspection. Retrying malformed data
    // would never succeed, so failing it loudly and once is correct.
    setRawStatus.run('rejected', errors.join(' | '), rawId);
    return {
      status: 'rejected',
      raw_event_id: rawId,
      errors,
      canonical,
      unmapped: meta.unmapped,
    };
  }

  const fingerprint = fingerprintOf(canonical, extractExplicitId(raw));

  const result = insertEvent.run({ fingerprint, raw_event_id: rawId, ...canonical });

  // THE FAILURE INJECTION POINT.
  // Thrown after the write has been staged but before commit — exactly the
  // window the brief describes. Everything above, including the raw_events
  // row, is discarded by the rollback.
  if (opts.simulateFailure) {
    throw Object.assign(new Error('Simulated database failure during write'), {
      simulated: true,
    });
  }

  if (result.changes === 0) {
    // The UNIQUE constraint rejected it: we have seen this exact event before.
    // We return 200, not an error. The client's retry has now succeeded from
    // its point of view, so it stops retrying — and the total is unchanged.
    const existing = findByFingerprint.get(fingerprint);
    setRawStatus.run('duplicate', `Matches existing event #${existing.id}`, rawId);
    return {
      status: 'duplicate',
      raw_event_id: rawId,
      fingerprint,
      event: existing,
      canonical,
      unmapped: meta.unmapped,
    };
  }

  setRawStatus.run('processed', meta.unmapped.length ? `Unmapped fields: ${meta.unmapped.join(', ')}` : null, rawId);

  return {
    status: 'processed',
    raw_event_id: rawId,
    fingerprint,
    event: findByFingerprint.get(fingerprint),
    canonical,
    unmapped: meta.unmapped,
  };
});

export function ingest(raw, { simulateFailure = false } = {}) {
  try {
    return runIngest(raw, { simulateFailure });
  } catch (err) {
    // We are here because the transaction rolled back. NOTHING was written.
    //
    // The audit row below is a SEPARATE transaction, written after the
    // rollback. It is intentionally not part of the atomic unit: its only
    // job is to make the failure visible in the UI. In a real outage the
    // database would be unreachable and this insert would fail too, which is
    // why it is wrapped in its own try/catch and why the real answer is to
    // log to stderr and let the client retry.
    try {
      insertRaw.run(JSON.stringify(raw), 'failed', err.message);
    } catch {
      console.error('Could not record failed attempt:', err.message);
    }

    return {
      status: 'failed',
      error: err.message,
      simulated: Boolean(err.simulated),
      // Told to the client explicitly: retrying is safe, because the
      // fingerprint will catch it if the write had in fact landed.
      retryable: true,
    };
  }
}