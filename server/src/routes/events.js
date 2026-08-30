import { Router } from 'express';
import { db } from '../db.js';
import { ingest } from '../services/ingest.js';

export const eventsRouter = Router();

/**
 * POST /api/events
 *
 * The route layer is deliberately thin: read the request, call the service,
 * map the outcome to a status code. No business logic lives here, so the
 * pipeline can be tested without HTTP.
 *
 * Status codes carry meaning for a retrying client:
 *   201 processed  - new event stored
 *   200 duplicate  - already had it; stop retrying, nothing was double counted
 *   422 rejected   - malformed; retrying will never help
 *   500 failed     - transient; retry is safe and expected
 */
eventsRouter.post('/events', (req, res) => {
  const simulateFailure =
    req.query.simulate_failure === 'true' || req.body?.__simulate_failure === true;

  // Strip the control flag so it never reaches the fingerprint or storage.
  const raw = { ...req.body };
  delete raw.__simulate_failure;

  const result = ingest(raw, { simulateFailure });

  const codes = { processed: 201, duplicate: 200, rejected: 422, failed: 500 };
  res.status(codes[result.status] ?? 500).json(result);
});

/**
 * GET /api/events - canonical, successfully processed events.
 */
eventsRouter.get('/events', (req, res) => {
  const { client_id, metric, from, to, limit = 100 } = req.query;

  const clauses = [];
  const params = { limit: Math.min(Number(limit) || 100, 500) };
  if (client_id) { clauses.push('client_id = @client_id'); params.client_id = client_id; }
  if (metric)    { clauses.push('metric = @metric');       params.metric = metric; }
  if (from)      { clauses.push('timestamp >= @from');     params.from = from; }
  if (to)        { clauses.push('timestamp <= @to');       params.to = to; }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = db.prepare(
    `SELECT * FROM events ${where} ORDER BY id DESC LIMIT @limit`
  ).all(params);

  res.json({ count: rows.length, events: rows });
});

/**
 * GET /api/raw-events - the audit trail, including rejections and failures.
 *
 * This is what makes the system debuggable: the exact bytes a client sent are
 * still here, alongside why we refused them.
 */
eventsRouter.get('/raw-events', (req, res) => {
  const { status, limit = 100 } = req.query;
  const params = { limit: Math.min(Number(limit) || 100, 500) };
  const where = status ? 'WHERE status = @status' : '';
  if (status) params.status = status;

  const rows = db.prepare(
    `SELECT * FROM raw_events ${where} ORDER BY id DESC LIMIT @limit`
  ).all(params);

  res.json({
    count: rows.length,
    raw_events: rows.map((r) => ({ ...r, raw: safeParse(r.raw_json) })),
  });
});

function safeParse(json) {
  try { return JSON.parse(json); } catch { return json; }
}