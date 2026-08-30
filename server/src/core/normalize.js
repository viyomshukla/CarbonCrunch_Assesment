import { aliasesFor, DEFAULT_ALIASES, NESTED_KEYS } from './mappings.js';
import { toNumber, toTimestamp, toTrimmedString } from './coerce.js';

/**
 * THE NORMALISATION LAYER.
 *
 * Pure function: raw object in, canonical object out. No database, no HTTP,
 * no side effects. That means it is trivially unit-testable and can be reused
 * later for replaying stored raw_events through updated rules.
 *
 * Design stance on strictness: normalisation is FORGIVING, validation is
 * STRICT. This layer tries hard to find and convert a value, and records
 * null when it cannot. It never throws and never rejects. Deciding whether a
 * null is acceptable is validate.js's job. Keeping those two concerns apart
 * means we can loosen or tighten the rules without touching the parsing.
 */

/**
 * Find a value by trying each alias, at the top level and inside any known
 * nested container. Returns { value, foundAt } so we can report where a
 * field came from — useful when debugging a client's odd format.
 */
function pluck(raw, aliases) {
  for (const alias of aliases) {
    if (raw?.[alias] !== undefined && raw[alias] !== null) {
      return { value: raw[alias], foundAt: alias };
    }
  }
  for (const container of NESTED_KEYS) {
    const nested = raw?.[container];
    if (!nested || typeof nested !== 'object') continue;
    for (const alias of aliases) {
      if (nested[alias] !== undefined && nested[alias] !== null) {
        return { value: nested[alias], foundAt: `${container}.${alias}` };
      }
    }
  }
  return { value: undefined, foundAt: null };
}

/**
 * Every key we consumed, so we can work out what was left over.
 */
function collectKnownKeys(clientId) {
  const known = new Set(NESTED_KEYS);
  for (const field of Object.keys(DEFAULT_ALIASES)) {
    for (const alias of aliasesFor(field, clientId)) known.add(alias);
  }
  // Idempotency keys are consumed by fingerprint.js, not unknown fields.
  for (const k of ['event_id', 'eventId', 'id', 'idempotency_key', 'idempotencyKey', 'uuid']) {
    known.add(k);
  }
  return known;
}

/**
 * UNKNOWN FIELDS DO NOT BREAK US.
 *
 * A client adding "region": "north" without warning must not cause a failure.
 * We ignore extras for the purpose of the canonical row, but we do record
 * their names, so the team can notice a client is sending something new and
 * decide whether to map it. Silent ignoring hides drift; loud failure breaks
 * ingestion. Recording is the middle path.
 */
function findUnmappedKeys(raw, clientId) {
  const known = collectKnownKeys(clientId);
  const extras = [];
  const scan = (obj, prefix) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const key of Object.keys(obj)) {
      if (!known.has(key)) extras.push(prefix ? `${prefix}.${key}` : key);
    }
  };
  scan(raw, '');
  for (const container of NESTED_KEYS) scan(raw?.[container], container);
  return extras;
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      canonical: { client_id: null, metric: null, amount: null, timestamp: null },
      meta: { unmapped: [], sources: {}, shapeError: 'Body must be a JSON object' },
    };
  }

  // client_id is resolved FIRST, because it selects the alias set for
  // everything else.
  const clientHit = pluck(raw, DEFAULT_ALIASES.client_id);
  const client_id = toTrimmedString(clientHit.value);

  const metricHit = pluck(raw, aliasesFor('metric', client_id));
  const amountHit = pluck(raw, aliasesFor('amount', client_id));
  const timeHit   = pluck(raw, aliasesFor('timestamp', client_id));

  return {
    canonical: {
      client_id,
      metric: toTrimmedString(metricHit.value),
      amount: toNumber(amountHit.value),
      timestamp: toTimestamp(timeHit.value),
    },
    meta: {
      unmapped: findUnmappedKeys(raw, client_id),
      // What we read, and what the client actually sent there. Makes a
      // rejection explainable: "amount came from payload.amt, value 'abc'".
      sources: {
        client_id: clientHit.foundAt,
        metric: metricHit.foundAt,
        amount: amountHit.foundAt,
        timestamp: timeHit.foundAt,
      },
      rawValues: {
        amount: amountHit.value,
        timestamp: timeHit.value,
      },
    },
  };
}