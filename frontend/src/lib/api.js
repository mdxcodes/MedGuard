/**
 * API fetch utility for MedGuard frontend.
 *
 * Provides a wrapper around fetch that returns structured results instead of
 * silently swallowing errors. Callers can distinguish between:
 *
 *   - Required endpoint failures  → show an actionable error state
 *   - Optional endpoint unavailable → show a graceful unavailable state
 *   - Empty but successful response → handle per schema
 *   - Invalid response → show a meaningful error
 *
 * Returns { ok: true, data } on success, or { ok: false, error } on failure.
 * The error object always contains: code, message, status (HTTP or null),
 * details (optional), and type ('network' | 'http' | 'parse').
 */

export class ApiError extends Error {
  constructor({ code, message, status, details, type = 'http' }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.type = type;
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      // Fall back to text if JSON parsing fails
      try {
        return await response.text();
      } catch {
        return null;
      }
    }
  }
  return await response.text();
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('/') ? path : '/' + path;

  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      const detail =
        body && typeof body === 'object' && !Array.isArray(body) && body.detail
          ? body.detail
          : typeof body === 'string'
            ? body
            : body != null
              ? JSON.stringify(body)
              : `Request failed with status ${response.status}`;
      throw new ApiError({
        code: body && typeof body === 'object' && !Array.isArray(body) && body.code ? body.code : `HTTP_${response.status}`,
        message: detail,
        status: response.status,
        details: body,
        type: 'http',
      });
    }

    return { ok: true, data: body };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: err };
    }
    // Network error, CORS issue, DNS failure, etc.
    return {
      ok: false,
      error: new ApiError({
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed',
        status: null,
        details: { original: err.message },
        type: 'network',
      }),
    };
  }
}

/**
 * Convenience wrapper for required endpoints. Throws on failure so callers
 * can use try/catch and show an error state.
 */
export async function apiFetchRequired(path, options = {}) {
  const result = await apiFetch(path, options);
  if (!result.ok) throw result.error;
  return result.data;
}

/**
 * Convenience wrapper for optional endpoints. Returns null on failure so
 * callers can show an "unavailable" state without crashing.
 */
export async function apiFetchOptional(path, options = {}) {
  const result = await apiFetch(path, options);
  if (!result.ok) return null;
  return result.data;
}

export default { apiFetch, apiFetchRequired, apiFetchOptional, ApiError };
