import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, apiFetchRequired, apiFetchOptional, ApiError } from '../api';

// Helper to mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(responseOrThrow, status = 200, ok = true) {
  if (responseOrThrow instanceof Error) {
    global.fetch = vi.fn(() => Promise.reject(responseOrThrow));
    return;
  }
  const body = typeof responseOrThrow === 'string' ? responseOrThrow : JSON.stringify(responseOrThrow);
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(responseOrThrow),
      text: () => Promise.resolve(body),
    })
  );
}

describe('apiFetch error contract', () => {
  it('returns ok data on success', async () => {
    mockFetch({ esi_level: 2, probabilities: [] });
    const result = await apiFetch('/api/predict');
    expect(result.ok).toBe(true);
    expect(result.data.esi_level).toBe(2);
  });

  it('returns structured error on non-2xx HTTP response', async () => {
    mockFetch({ detail: 'Invalid input', code: 'VALIDATION_ERROR' }, 422, false);
    const result = await apiFetch('/api/predict');
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error.status).toBe(422);
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.message).toBe('Invalid input');
    expect(result.error.type).toBe('http');
  });

  it('returns structured error on network failure', async () => {
    mockFetch(new Error('Failed to fetch'));
    const result = await apiFetch('/api/predict');
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error.status).toBeNull();
    expect(result.error.code).toBe('NETWORK_ERROR');
    expect(result.error.type).toBe('network');
  });

  it('returns null body for invalid JSON on error response', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('invalid json')),
        text: () => Promise.resolve('Internal Server Error'),
      })
    );
    const result = await apiFetch('/api/predict');
    expect(result.ok).toBe(false);
    expect(result.error.status).toBe(500);
    expect(result.error.message).toBe('Internal Server Error');
  });

  it('apiFetchRequired throws on failure', async () => {
    mockFetch({ detail: 'Not found' }, 404, false);
    await expect(apiFetchRequired('/api/predict')).rejects.toBeInstanceOf(ApiError);
  });

  it('apiFetchRequired returns data on success', async () => {
    mockFetch({ ok: true });
    const data = await apiFetchRequired('/api/predict');
    expect(data.ok).toBe(true);
  });

  it('apiFetchOptional returns null on failure', async () => {
    mockFetch({ detail: 'Not found' }, 404, false);
    const result = await apiFetchOptional('/api/triagegeist/status');
    expect(result).toBeNull();
  });

  it('apiFetchOptional returns data on success', async () => {
    mockFetch({ available: true });
    const result = await apiFetchOptional('/api/triagegeist/status');
    expect(result.available).toBe(true);
  });

  it('ApiError has correct properties', async () => {
    mockFetch({ detail: 'Boom', code: 'TEST_CODE' }, 500, false);
    const result = await apiFetch('/api/predict');
    expect(result.error.code).toBe('TEST_CODE');
    expect(result.error.status).toBe(500);
    expect(result.error.message).toBe('Boom');
  });
});
