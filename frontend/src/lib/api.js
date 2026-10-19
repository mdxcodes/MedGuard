/**
 * API fetch utility for MedGuard frontend.
 *
 * Provides a wrapper around fetch that gracefully handles cases where
 * the backend API is not running. Returns null on failure instead of
 * throwing, allowing components to show "unavailable" fallback states.
 */

export async function apiFetch(path, options = {}) {
  try {
    // Construct the full URL - relative paths go to the same origin
    const url = path.startsWith('/') ? path : '/' + path;

    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    // If the response is not OK, still return the JSON if possible,
    // but treat non-2xx as "unavailable" rather than an error
    if (!response.ok) {
      // Try to parse error body, but don't throw - let caller handle unavailable
      const text = await response.text();
      try {
        return JSON.parse(text) || null;
      } catch {
        return null;
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Network error, CORS issue, or backend not running
    // Return null so callers can show "unavailable" state
    return null;
  }
}