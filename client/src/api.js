/**
 * Every call to the backend goes through here.
 *
 * Note the deliberate absence of error throwing on non-2xx responses. The
 * backend uses status codes to describe OUTCOMES, not just faults: 422 means
 * "rejected", 500 means "the write failed, retry is safe". Both are results
 * the UI needs to display, not exceptions to swallow. So we return the parsed
 * body either way and let the caller decide.
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const body = await res.json().catch(() => ({
    status: 'failed',
    error: 'Server returned a response that was not JSON',
  }));
  return { httpStatus: res.status, ...body };
}

export function submitEvent(rawJsonText, { simulateFailure = false } = {}) {
  const query = simulateFailure ? '?simulate_failure=true' : '';
  return request(`/events${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawJsonText,
  });
}

export function fetchEvents(filters = {}) {
  return request(`/events?${toQuery(filters)}`);
}

export function fetchRawEvents(filters = {}) {
  return request(`/raw-events?${toQuery(filters)}`);
}

export function fetchAggregates(filters = {}) {
  return request(`/aggregates?${toQuery(filters)}`);
}

function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  }
  return params.toString();
}