import express from 'express';
import cors from 'cors';
import { eventsRouter } from './routes/events.js';
import { aggregatesRouter } from './routes/aggregates.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Malformed JSON is a client error, not a crash. Express's body parser throws
// on bad JSON, so we catch it and answer in the same shape as a rejection.
app.use(express.json({ limit: '256kb' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ status: 'rejected', errors: ['Request body is not valid JSON'] });
  }
  next(err);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', eventsRouter);
app.use('/api', aggregatesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: 'failed', error: 'Internal error', retryable: true });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});