import { useCallback, useEffect, useState } from 'react';
import { submitEvent, fetchEvents, fetchRawEvents, fetchAggregates } from './api.js';
import EventForm from './components/EventForm.jsx';
import PipelineTrace from './components/PipelineTrace.jsx';
import Aggregates from './components/Aggregates.jsx';
import EventsTable from './components/EventsTable.jsx';
import StatusBar from './components/StatusBar.jsx';
import ThemeSwitch from './components/ThemeSwitch.jsx';

const EMPTY_FILTERS = { client_id: '', fromDate: '', toDate: '' };

/**
 * Date inputs give a plain day; the API compares ISO instants. Widening the
 * end of the range to the last moment of the chosen day makes "to: 1 Jan"
 * include events that happened on 1 January, which is what a person means.
 */
function toApiFilters({ client_id, fromDate, toDate }) {
  return {
    client_id: client_id.trim(),
    from: fromDate ? `${fromDate}T00:00:00.000Z` : '',
    to: toDate ? `${toDate}T23:59:59.999Z` : '',
  };
}

export default function App() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState('client_id');
  const [events, setEvents] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [aggregates, setAggregates] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  // Bumped on every submit. Used as a React key so the trace replays its
  // animation even when two identical submissions produce the same outcome.
  const [resultSeq, setResultSeq] = useState(0);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  // Distinguishes "nothing has loaded yet" from "loaded, and it is empty",
  // so the first paint shows skeletons rather than a false empty state.
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const apiFilters = toApiFilters(filters);
    try {
      const [eventsRes, rawRes, aggRes] = await Promise.all([
        fetchEvents(apiFilters),
        fetchRawEvents({}),
        fetchAggregates({ ...apiFilters, group_by: groupBy }),
      ]);
      setEvents(eventsRes.events ?? []);
      setRawEvents(rawRes.raw_events ?? []);
      setAggregates(aggRes);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoaded(true);
    }
  }, [filters, groupBy]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(rawJsonText, options) {
    setBusy(true);
    try {
      const result = await submitEvent(rawJsonText, options);
      setLastResult(result);
      setResultSeq((n) => n + 1);
      // Always refresh, including after a failure: proving the totals did NOT
      // move is the point of the failure demonstration.
      await refresh();
    } catch {
      setLastResult({
        status: 'failed',
        error: 'Could not reach the server. Is it running on port 4000?',
      });
      setResultSeq((n) => n + 1);
      setOffline(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__text">
          <div className="masthead__mark">
            <span className="masthead__rule" aria-hidden="true" />
            <span className="masthead__eyebrow">Fault-tolerant ingestion</span>
          </div>
          <h1 className="masthead__title">Ingest Console</h1>
          <p className="masthead__lede">
            Unreliable events in, one canonical record out. Retries and failed writes
            leave the totals untouched.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <StatusBar offline={offline} ingestion={aggregates?.ingestion} />

      {offline && (
        <p className="banner">
          <span aria-hidden="true">⚠</span>
          <span>
            No response from the API. Start the server with <code>npm start</code> in
            the server folder, then reload.
          </span>
        </p>
      )}

      <main className="layout">
        <div className="column">
          <EventForm onSubmit={handleSubmit} busy={busy} />
          <PipelineTrace key={resultSeq} result={lastResult} live={resultSeq > 0} />
        </div>
        <div className="column">
          <Aggregates
            data={aggregates}
            loading={!loaded}
            filters={filters}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
          <EventsTable events={events} rawEvents={rawEvents} loading={!loaded} />
        </div>
      </main>

      <footer className="footnote">
        <span>Normalise → Validate → Fingerprint → Commit</span>
        <span>Totals derived on read, never incremented</span>
        <span>Raw bodies retained whatever the outcome</span>
      </footer>
    </div>
  );
}
