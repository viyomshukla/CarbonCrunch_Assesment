

/**
 * Where the API lives.
 *
 * Unset (local dev): requests go to /api on the same origin and Vite's proxy
 * forwards them to localhost:4000, so there is no CORS negotiation and no
 * hardcoded port in this file.
 *
 * Set (deployed): VITE_API_URL is the backend ORIGIN only, e.g.
 * https://carbon-crunch-api.onrender.com — the /api prefix is added here so
 * the variable cannot be got subtly wrong by including or omitting it.
 */
const ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const BASE = `${ORIGIN}/api`;

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