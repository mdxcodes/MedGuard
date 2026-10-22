import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import { ModelStatusProvider } from '../ModelStatusProvider';
import { ModeProvider } from '../ModeProvider';
import Header from '../../components/Header';
import { MemoryRouter } from 'react-router-dom';
import { memoryStorage } from '../../test/helpers';

/**
 * The status chip must not report a healthy API as broken.
 *
 * A reachable API that has no model artifact loaded answers /model-info with
 * 503. Reporting that as "unavailable" made a working deployment look like
 * an outage, so the two conditions are distinguished.
 */

function renderHeader({ health, modelInfo }) {
  global.fetch = vi.fn(async (url) => {
    const path = String(url);
    const spec = path.includes('/health') ? health : modelInfo;
    // A status of 0 stands for "the request never completed".
    if (spec.status === 0) {
      throw new TypeError('Failed to fetch');
    }
    return {
      ok: spec.status < 400,
      status: spec.status,
      headers: { get: () => 'application/json' },
      json: async () => spec.body,
      text: async () => JSON.stringify(spec.body),
    };
  });

  return render(
    <MemoryRouter initialEntries={['/']}>
      <ModeProvider storage={memoryStorage()}>
        <ModelStatusProvider>
          <Header onMenu={() => {}} />
        </ModelStatusProvider>
      </ModeProvider>
    </MemoryRouter>,
  );
}

const OK_HEALTH = { status: 200, body: { status: 'ok' } };
const NO_MODEL = {
  status: 503,
  body: { detail: 'Missing model artifact (...); set MEDGUARD_MODEL_URL to fetch it' },
};
const READY_MODEL = {
  status: 200,
  body: { model_name: 'random_forest', dataset: 'Triagegeist' },
};

describe('Header status indicator', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reports the API as online when the model artifact is not loaded', async () => {
    renderHeader({ health: OK_HEALTH, modelInfo: NO_MODEL });

    await waitFor(() => {
      expect(screen.getByTitle(/API is running, but the model artifact is not loaded/i)).toBeInTheDocument();
    });
    expect(screen.getByText('API online')).toBeInTheDocument();
    expect(screen.getByText(/model not loaded/i)).toBeInTheDocument();
    expect(screen.queryByText('Model unavailable')).not.toBeInTheDocument();
  });

  it('reports the model as ready when the artifact is loaded', async () => {
    renderHeader({ health: OK_HEALTH, modelInfo: READY_MODEL });

    await waitFor(() => {
      expect(screen.getByText('Model ready')).toBeInTheDocument();
    });
  });

  it('reports an offline API when the backend cannot be reached', async () => {
    renderHeader({ health: { status: 0, body: {} }, modelInfo: { status: 0, body: {} } });

    await waitFor(() => {
      expect(screen.getByText('API offline')).toBeInTheDocument();
    });
  });
});
