/**
 * WHERE CLIENT-SPECIFIC KNOWLEDGE LIVES.
 *
 * The brief says "don't hardcode client-specific logic everywhere". So it
 * lives here and nowhere else. Adding client_D is a data change in this file,
 * not a code change in the ingestion path.
 *
 * Order matters: the first alias found wins.
 */

// Aliases we accept from any client, tried when no specific mapping matches.
// This is what keeps us working when a brand-new client appears unannounced.
export const DEFAULT_ALIASES = {
  client_id: ['client_id', 'clientId', 'source', 'client', 'src', 'sender', 'origin'],
  metric:    ['metric', 'type', 'kind', 'name', 'metric_name', 'event_type'],
  amount:    ['amount', 'total', 'amt', 'value', 'qty', 'quantity', 'sum'],
  timestamp: ['timestamp', 'time', 'date', 'ts', 'occurred_at', 'created_at', 'event_time'],
};

// Per-client overrides, merged in FRONT of the defaults.
// Use this only when a client's naming genuinely conflicts with the defaults.
export const CLIENT_ALIASES = {
  client_B: {
    // client_B uses "value" as its metric NAME, and "total" for the number.
    // Without this override, the generic "amount" list would grab "value".
    metric: ['type', 'metric'],
    amount: ['total'],
  },
};

// Nested containers to look inside. Clients wrap their data differently.
export const NESTED_KEYS = ['payload', 'data', 'body', 'attributes', 'event'];

/**
 * Resolve the alias list for one canonical field, for one client.
 */
export function aliasesFor(field, clientId) {
  const override = clientId && CLIENT_ALIASES[clientId]?.[field];
  const defaults = DEFAULT_ALIASES[field] || [];
  if (!override) return defaults;
  // Override first, then defaults as a safety net.
  return [...override, ...defaults.filter((a) => !override.includes(a))];
}