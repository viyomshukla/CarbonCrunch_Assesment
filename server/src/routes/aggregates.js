import { Router } from 'express';
import { aggregate, ingestionStats } from '../services/aggregate.js';

export const aggregatesRouter = Router();

/**
 * GET /api/aggregates
 *
 * Query params:
 *   client_id  filter to one client
 *   metric     filter to one metric
 *   from, to   ISO 8601 time range, inclusive
 *   group_by   client_id (default) | metric | none
 *
 * Example:
 *   /api/aggregates?client_id=client_A&from=2024-01-01T00:00:00Z&group_by=metric
 */
aggregatesRouter.get('/aggregates', (req, res) => {
  const { client_id, metric, from, to, group_by } = req.query;
  res.json({
    ...aggregate({ client_id, metric, from, to, group_by }),
    ingestion: ingestionStats(),
  });
});