import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The API client resolves the backend base URL once, at import time, from
 * `VITE_API_BASE_URL`. In production that points at the Render service; when
 * it is unset the request stays relative so the Vite dev proxy handles it.
 *
 * The module is re-imported per case because the base URL is captured at
 * module scope.
 */
async function loadClient(baseUrl) {
  vi.resetModules();
  if (baseUrl === undefined) {
    vi.stubEnv('VITE_API_BASE_URL', '');
  } else {
    vi.stubEnv('VITE_API_BASE_URL', baseUrl);
  }
  const mod = await import('../api.js');
  return mod;
}

describe('API base URL resolution', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
    }));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the request relative when no base URL is configured', async () => {
    const { apiFetch } = await loadClient('');
    await apiFetch('/api/predict', { method: 'POST' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/predict');
  });

  it('drops the /api prefix and targets the backend root when a base URL is set', async () => {
    const { apiFetch } = await loadClient('https://medguard-api.onrender.com');
    await apiFetch('/api/predict', { method: 'POST' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://medguard-api.onrender.com/predict');
  });

  it('tolerates a trailing slash and a trailing /api on the base URL', async () => {
    const { apiFetch } = await loadClient('https://medguard-api.onrender.com/api/');
    await apiFetch('/api/model-info');
    expect(fetchMock.mock.calls[0][0]).toBe('https://medguard-api.onrender.com/model-info');
  });

  it('leaves an already absolute URL untouched', async () => {
    const { apiFetch } = await loadClient('https://medguard-api.onrender.com');
    await apiFetch('https://elsewhere.example/health');
    expect(fetchMock.mock.calls[0][0]).toBe('https://elsewhere.example/health');
  });
});
