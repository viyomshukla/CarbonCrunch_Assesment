/**
 * Type coercion. Every function here returns null on failure rather than
 * throwing, so the caller can collect ALL the problems with an event and
 * report them together instead of failing on the first one.
 */

/**
 * "1200" -> 1200 | 1200 -> 1200 | "1,200.00" -> 1200 | "₹1200" -> 1200
 * "abc" -> null | "" -> null | null -> null | true -> null
 *
 * We reject booleans explicitly: Number(true) is 1, which would silently
 * turn a flag into an amount of 1.
 */
export function toNumber(input) {
  if (input === null || input === undefined || typeof input === 'boolean') return null;

  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  if (typeof input === 'string') {
    // Strip currency symbols, spaces and thousands separators.
    const cleaned = input.replace(/[\s,\u00A0]/g, '').replace(/^[^\d\-+.]+/, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '+') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

const ISO_LIKE   = /^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/;
const SLASHED    = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;        // 2024/01/01
const DMY        = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;  // 01-01-2024

/**
 * Anything date-shaped -> "2024-01-01T00:00:00.000Z", or null.
 *
 * AMBIGUITY, DOCUMENTED: "01-02-2024" could be 1 Feb or 2 Jan. We assume
 * DD-MM-YYYY (day first), which is the common convention outside the US.
 * This is a guess, and a wrong guess silently shifts an event to the wrong
 * day. The right long-term fix is a per-client date_format in mappings.js;
 * we chose the simpler default for now and are flagging it rather than
 * hiding it.
 */
export function toTimestamp(input) {
  if (input === null || input === undefined) return null;

  // Unix epoch, seconds or milliseconds.
  if (typeof input === 'number' && Number.isFinite(input)) {
    const ms = input > 1e11 ? input : input * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  // Numeric string that is actually an epoch.
  if (/^\d{10}$|^\d{13}$/.test(s)) return toTimestamp(Number(s));

  let m;
  if ((m = s.match(SLASHED))) {
    return buildUTC(m[1], m[2], m[3]);
  }
  if ((m = s.match(DMY))) {
    // Day-first assumption. See note above.
    return buildUTC(m[3], m[2], m[1]);
  }
  if (ISO_LIKE.test(s)) {
    // Date-only ISO is treated as midnight UTC, not local midnight, so the
    // same input never lands on different days on different machines.
    const d = new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildUTC(year, month, day) {
  const y = Number(year), mo = Number(month), d = Number(day);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Catches things like 31 February rolling over into March.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString();
}

export function toTrimmedString(input) {
  if (typeof input === 'string') {
    const s = input.trim();
    return s === '' ? null : s;
  }
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);
  return null;
}