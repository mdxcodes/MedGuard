import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, memoryStorage, mockPredictFetch } from '../../test/helpers';
import { MODE_RESEARCH, MODE_STORAGE_KEY } from '../../lib/modeStorage';

/**
 * Regression tests for the two research pages whose fields were silently
 * blank: "Model & dataset status" (/triagegeist) and "Model registry"
 * (/registry).
 *
 * The failure mode was silent — a missing key renders an em dash rather than
 * an error — so these tests assert on the actual values.
 */

const REGISTRY_ACTIVE = {
  version: 'v1',
  model_name: 'random_forest',
  active: true,
  integrity: { ok: true, checks: ['model_sha256_match'], errors: [] },
  metadata: {
    dataset: 'Triagegeist',
    training_rows: 80000,
    training_patients: 80000,
    esi_labels: [1, 2, 3, 4, 5],
    target: 'triage_acuity',
    class_distribution: { 'ESI 1': 3222, 'ESI 2': 13439, 'ESI 3': 28921, 'ESI 4': 23020, 'ESI 5': 11398 },
    random_seed: 20260915,
    created_utc: '2026-10-21T10:17:50+00:00',
  },
  artifact: { model_exists: true, manifest_exists: true },
};

const TRIAGEGEIST_STATUS = {
  available: true,
  dataset: 'triagegeist',
  profile: {
    dataset: 'Triagegeist',
    version: 'synthetic',
    reference_dataset: 'Triagegeist (synthetic)',
    split_protocol: 'patient-grouped 80/20 holdout, 5-fold grouped CV',
    train_rows: 80000,
    train_patients: 80000,
    test_rows: 20000,
    test_patients: 20000,
    patient_overlap_train_test: 0,
    file_inventory: {
      'train.csv': { rows: 80000, has_labels: true },
      'test.csv': { rows: 20000, has_labels: false },
    },
    target_distribution_train: { 'ESI 1': 3222, 'ESI 2': 13439, 'ESI 3': 28921, 'ESI 4': 23020, 'ESI 5': 11398 },
  },
  benchmark_results: {
    model_results: {
      dummy: { balanced_accuracy: 0.2, macro_f1: 0.107, quadratic_weighted_kappa: 0.0 },
      logistic_regression: { balanced_accuracy: 0.828, macro_f1: 0.808, quadratic_weighted_kappa: 0.896 },
      random_forest: { balanced_accuracy: 0.834, macro_f1: 0.842, quadratic_weighted_kappa: 0.912 },
    },
  },
  manifest: {
    random_seed: 20260915,
    target: 'triage_acuity (ESI levels 1-5)',
    esi_labels: [1, 2, 3, 4, 5],
    generated_at_utc: '2026-10-21T17:37:03+00:00',
  },
};

/** Route fetch calls to the mock payloads. */
function mockApi(overrides = {}) {
  const routes = {
    '/api/models/active': REGISTRY_ACTIVE,
    '/api/models/versions': [
      {
        version: 'v1',
        model_name: 'random_forest',
        active: true,
        manifest_path: '/models/triagegeist/triage_model.manifest.json',
        model_path: '/models/triagegeist/triage_model.joblib',
        dataset: 'Triagegeist',
        training_rows: 80000,
      },
    ],
    '/api/triagegeist/status': TRIAGEGEIST_STATUS,
    ...overrides,
  };
  global.fetch = vi.fn(async (url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) {
      return { ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}' };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => routes[key],
      text: async () => JSON.stringify(routes[key]),
    };
  });
}

const research = () => memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });

describe('Model registry page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApi();
  });

  it('shows the active model served by the backend', async () => {
    renderApp({ route: '/registry', storage: research() });
    await screen.findByText('Serving model');
    expect(screen.getAllByText('random_forest').length).toBeGreaterThan(0);
  });

  it('shows the real training size, not an em dash', async () => {
    renderApp({ route: '/registry', storage: research() });
    await screen.findByText('Training rows');
    expect(screen.getAllByText('80,000').length).toBeGreaterThan(0);
    // The training-rows metric itself must not be a placeholder.
    const metric = screen.getByText('Training rows').closest('div')?.parentElement;
    expect(metric?.textContent).not.toContain('—');
  });

  it('interpolates the unique-patient subtitle instead of printing the literal', async () => {
    renderApp({ route: '/registry', storage: research() });
    expect(await screen.findByText('Unique patients: 80,000')).toBeInTheDocument();
    expect(screen.queryByText(/\{active\?/)).not.toBeInTheDocument();
  });

  it('names the dataset and target of the served model', async () => {
    renderApp({ route: '/registry', storage: research() });
    expect(await screen.findByText(/Target: triage_acuity/)).toBeInTheDocument();
    expect(screen.getAllByText('Triagegeist').length).toBeGreaterThan(0);
  });

  it('renders the training class distribution', async () => {
    renderApp({ route: '/registry', storage: research() });
    await screen.findByText('Training class distribution');
    expect(screen.getByText('3,222')).toBeInTheDocument();
    expect(screen.getByText('28,921')).toBeInTheDocument();
  });

  it('reports integrity from the response rather than assuming it', async () => {
    mockApi({
      '/api/models/active': {
        ...REGISTRY_ACTIVE,
        integrity: { ok: false, checks: [], errors: ['sha256_mismatch'] },
      },
    });
    renderApp({ route: '/registry', storage: research() });
    expect(await screen.findByText(/Integrity issues/i)).toBeInTheDocument();
  });
});

describe('Model & dataset status page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockApi();
  });

  it('shows the released train and test counts', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    await screen.findByText('Train rows');
    expect(screen.getAllByText('80,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20,000').length).toBeGreaterThan(0);
  });

  it('shows the patient overlap as zero', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    expect(await screen.findByText('0 = no patient leakage')).toBeInTheDocument();
  });

  it('shows the split protocol and reference dataset', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    expect(await screen.findByText('patient-grouped 80/20 holdout, 5-fold grouped CV')).toBeInTheDocument();
  });

  it('labels the benchmark models readably and marks the selected one', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    expect(await screen.findByText('Dummy (majority class)')).toBeInTheDocument();
    expect(screen.getByText('Logistic regression')).toBeInTheDocument();
    expect(screen.getByText('Random forest')).toBeInTheDocument();
  });

  it('shows the reproducibility fields from the manifest', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    expect(await screen.findByText('20260915')).toBeInTheDocument();
    expect(screen.getByText('triage_acuity (ESI levels 1-5)')).toBeInTheDocument();
  });

  it('lists the released files with their row counts', async () => {
    renderApp({ route: '/triagegeist', storage: research() });
    expect(await screen.findByText('train.csv')).toBeInTheDocument();
    expect(screen.getByText('test.csv')).toBeInTheDocument();
    expect(screen.getByText('withheld')).toBeInTheDocument();
  });
});
