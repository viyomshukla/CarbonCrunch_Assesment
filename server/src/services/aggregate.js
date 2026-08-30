import { db } from '../db.js';

/**
 * AGGREGATION. Kept entirely separate from ingestion — this file has no idea
 * that normalisation or fingerprints exist. It reads canonical rows, nothing
 * more.
 *
 * KEY DECISION: totals are COMPUTED ON READ, not maintained as a running
 * counter during ingestion.
 *
 * If we incremented a stored total on every write, that counter could drift
 * out of sync with the events table after any partial failure, and there
 * would be no way to tell that it had. A derived total cannot drift: it is
 * recalculated from the same rows that define the truth. Combined with
 * deduplication, this is what makes the API "consistent despite retries and
 * failures".
 *
 * The cost is that every query scans matching rows. That is the correct
 * trade at this size, and the first thing to change at scale (see README).
 */

/**
 * Filters are built as parameterised fragments — never string-concatenated
 * values — so a client_id containing SQL cannot alter the query.
 */
function buildFilters({ client_id, metric, from, to }) {
  const clauses = [];
  const params = {};

  if (client_id) { clauses.push('client_id = @client_id'); params.client_id = client_id; }
  if (metric)    { clauses.push('metric = @metric');       params.metric = metric; }
  // Timestamps are stored as ISO 8601 UTC strings, so lexicographic
  // comparison is chronological comparison. That is why the canonical format
  // insists on one timezone and one layout.
  if (from)      { clauses.push('timestamp >= @from');     params.from = from; }
  if (to)        { clauses.push('timestamp <= @to');       params.to = to; }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function aggregate(filters = {}) {
  const { where, params } = buildFilters(filters);
  const groupBy = filters.group_by === 'metric' ? 'metric'
                : filters.group_by === 'none'   ? null
                : 'client_id';

  const totals = db.prepare(`
    SELECT COUNT(*) AS event_count,
           COALESCE(SUM(amount), 0) AS total_amount,
           COALESCE(AVG(amount), 0) AS average_amount,
           MIN(timestamp) AS earliest,
           MAX(timestamp) AS latest
    FROM events ${where}
  `).get(params);

  const groups = groupBy
    ? db.prepare(`
        SELECT ${groupBy} AS group_key,
               COUNT(*) AS event_count,
               COALESCE(SUM(amount), 0) AS total_amount
        FROM events ${where}
        GROUP BY ${groupBy}
        ORDER BY total_amount DESC
      `).all(params)
    : [];

  return { filters, group_by: groupBy, totals, groups };
}

/**
 * Ingestion health counters, read from raw_events. Useful in the UI and a
 * cheap way to prove that duplicates and failures were handled rather than
 * silently swallowed.
 */
export function ingestionStats() {
  const rows = db.prepare(
    `SELECT status, COUNT(*) AS count FROM raw_events GROUP BY status`
  ).all();
  const stats = { processed: 0, rejected: 0, duplicate: 0, failed: 0 };
  for (const r of rows) stats[r.status] = r.count;
  return stats;
}