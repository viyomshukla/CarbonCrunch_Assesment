import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

export const db = new Database(DB_PATH);

// WAL lets readers (the aggregation API) run while a writer (ingestion) holds
// a transaction, instead of blocking on it.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Every request lands here EXACTLY as the client sent it, untouched.
  -- We never mutate raw_json. If a normalisation rule turns out to be wrong,
  -- we still have the original and can replay it.
  CREATE TABLE IF NOT EXISTS raw_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT    NOT NULL DEFAULT (datetime('now')),
    raw_json    TEXT    NOT NULL,
    status      TEXT    NOT NULL CHECK (status IN ('processed','rejected','duplicate','failed')),
    reason      TEXT
  );

  -- The canonical form. Only well-formed events reach this table, so every
  -- aggregation query can trust these columns without defensive checks.
  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint  TEXT    NOT NULL UNIQUE,
    raw_event_id INTEGER NOT NULL REFERENCES raw_events(id),
    client_id    TEXT    NOT NULL,
    metric       TEXT    NOT NULL,
    amount       REAL    NOT NULL,
    timestamp    TEXT    NOT NULL,          -- ISO 8601 UTC, always
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_client    ON events(client_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_metric    ON events(metric);
  CREATE INDEX IF NOT EXISTS idx_raw_status       ON raw_events(status);
`);

export default db;