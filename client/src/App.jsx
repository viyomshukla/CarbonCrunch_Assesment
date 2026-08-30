import { useCallback, useEffect, useState } from 'react';
import { submitEvent, fetchEvents, fetchRawEvents, fetchAggregates } from './api.js';
import EventForm from './components/EventForm.jsx';
import PipelineTrace from './components/PipelineTrace.jsx';
import Aggregates from './components/Aggregates.jsx';
import EventsTable from './components/EventsTable.jsx';

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
  const [events, setEvents] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [aggregates, setAggregates] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    const apiFilters = toApiFilters(filters);
    try {
      const [eventsRes, rawRes, aggRes] = await Promise.all([
        fetchEvents(apiFilters),
        fetchRawEvents({}),
        fetchAggregates(apiFilters),
      ]);
      setEvents(eventsRes.events ?? []);
      setRawEvents(rawRes.raw_events ?? []);
      setAggregates(aggRes);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(rawJsonText, options) {
    setBusy(true);
    try {
      const result = await submitEvent(rawJsonText, options);
      setLastResult(result);
      // Always refresh, including after a failure: proving the totals did NOT
      // move is the point of the failure demonstration.
      await refresh();
    } catch {
      setLastResult({
        status: 'failed',
        error: 'Could not reach the server. Is it running on port 4000?',
      });
      setOffline(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead__mark">
          <span className="masthead__rule" aria-hidden="true" />
          <span className="masthead__eyebrow">Fault-tolerant ingestion</span>
        </div>
        <h1 className="masthead__title">Ingest Console</h1>
        <p className="masthead__lede">
          Unreliable events in, one canonical record out. Retries and failed writes
          leave the totals untouched.
        </p>
        {offline && (
          <p className="banner">
            No response from the API. Start the server with <code>npm start</code> in
            the server folder, then reload.
          </p>
        )}
      </header>

      <main className="layout">
        <div className="column">
          <EventForm onSubmit={handleSubmit} busy={busy} />
          <PipelineTrace result={lastResult} />
        </div>
        <div className="column">
          <Aggregates
            data={aggregates}
            filters={filters}
            onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
          <EventsTable events={events} rawEvents={rawEvents} />
        </div>
      </main>
    </div>
  );
}