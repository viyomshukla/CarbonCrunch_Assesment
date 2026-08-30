import { createHash } from 'node:crypto';

// Bump this if the fingerprint recipe ever changes. Without it, old rows and
// new rows would silently use different rules and dedup would break.
const VERSION = 'v1';

/**
 * Build the dedup key for a canonical event.
 *
 * Two paths, in priority order:
 *
 * 1. The client sent an explicit idempotency key / event id. Trust it, scoped
 *    to that client so two clients can't collide with each other.
 * 2. No id available (the assignment says this is the normal case). Derive a
 *    key from the event's own content.
 *
 * We deliberately hash the NORMALISED values, not the raw ones. "1200",
 * 1200 and " 1200 " all become the number 1200 first, so a client that
 * changes its formatting mid-flight does not defeat deduplication.
 *
 * Known trade-off, stated openly: two genuinely distinct events with the same
 * client, metric, amount and timestamp collapse into one. Given the constraints
 * (no unique id, unreliable timestamps, retries after partial failure), we
 * chose to under-count in that rare case rather than double-count on every
 * retry. Double counting corrupts aggregates silently; a dropped duplicate is
 * visible in the raw_events log as status='duplicate'.
 */
export function fingerprintOf(canonical, explicitId) {
  const basis = explicitId
    ? ['id', VERSION, canonical.client_id, String(explicitId)]
    : [
        'content',
        VERSION,
        canonical.client_id,
        canonical.metric,
        // Fixed precision so 1200 and 1200.0 hash identically.
        canonical.amount.toFixed(6),
        canonical.timestamp,
      ];

  return createHash('sha256').update(basis.join('\u0000')).digest('hex');
}

// Field names clients might use for an idempotency key.
const ID_KEYS = ['event_id', 'eventId', 'id', 'idempotency_key', 'idempotencyKey', 'uuid'];

export function extractExplicitId(raw) {
  const search = [raw, raw?.payload, raw?.data].filter((o) => o && typeof o === 'object');
  for (const obj of search) {
    for (const key of ID_KEYS) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (typeof val === 'number') return String(val);
    }
  }
  return null;
}