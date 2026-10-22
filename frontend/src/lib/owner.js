/**
 * Per-browser owner token.
 *
 * The browser never talks to the database directly. It presents an opaque
 * token that the backend uses to scope every history query, so one visitor
 * can never see another's records.
 *
 * The token is a random identifier, not a credential: it carries no
 * authority of its own, and the database is not reachable from the browser
 * at all (Row Level Security denies the publishable key).
 */

const OWNER_STORAGE_KEY = 'medguard.owner.token';

const OWNER_HEADER = 'X-MedGuard-Owner';

function randomToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Return this browser's owner token, creating and storing one on first use.
 *
 * Returns an empty string when storage is unavailable, in which case the
 * backend will not store the assessment rather than storing it unscoped.
 */
export function getOwnerToken() {
  try {
    const stored = window.localStorage.getItem(OWNER_STORAGE_KEY);
    if (stored) return stored;
    const token = randomToken();
    window.localStorage.setItem(OWNER_STORAGE_KEY, token);
    return token;
  } catch {
    return '';
  }
}

/** The header the owner token is sent in. */
export const OWNER_HEADER_NAME = OWNER_HEADER;

/** Headers to merge into a request so the backend can scope the record. */
export function ownerHeaders() {
  const token = getOwnerToken();
  return token ? { [OWNER_HEADER]: token } : {};
}
