import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ModeProvider } from '../app/ModeProvider';
import { AssessmentProvider } from '../app/AssessmentProvider';
import { ModelStatusProvider } from '../app/ModelStatusProvider';
import AppShell from '../app/AppShell';

/**
 * Test helpers for the dual-mode application.
 */

/** Render a component inside the mode + assessment providers. */
export function renderWithProviders(ui, { route = '/', storage } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ModeProvider storage={storage}>
        <AssessmentProvider>{ui}</AssessmentProvider>
      </ModeProvider>
    </MemoryRouter>,
  );
}

/** Render the whole application shell at a given route. */
export function renderApp({ route = '/', storage } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ModeProvider storage={storage}>
        <AssessmentProvider>
          <ModelStatusProvider>
            <AppShell />
          </ModelStatusProvider>
        </AssessmentProvider>
      </ModeProvider>
    </MemoryRouter>,
  );
}

/** An in-memory localStorage stand-in. */
export function memoryStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
    get length() { return Object.keys(store).length; },
    key: (index) => Object.keys(store)[index] ?? null,
    _store: store,
  };
}

/** A representative successful prediction response. */
export const MOCK_PREDICT_RESPONSE = {
  prediction: {
    predicted_esi_level: 3,
    probabilities: [
      { esi_level: 1, probability: 0.02 },
      { esi_level: 2, probability: 0.18 },
      { esi_level: 3, probability: 0.61 },
      { esi_level: 4, probability: 0.14 },
      { esi_level: 5, probability: 0.05 },
    ],
    note: 'Probabilities reflect model confidence, not clinical calibration.',
  },
  explanation: {
    explanation_status: 'available',
    predicted_class: 3,
    explained_class: 3,
    top_features: [
      { feature: 'heart_rate', shap_value: 0.0313, sample_value: -0.19 },
      { feature: 'spo2', shap_value: 0.0241, sample_value: 0.51 },
      { feature: 'temperature_c', shap_value: 0.0434, sample_value: -0.73 },
    ],
    note: 'Attribution indicates model feature sensitivity, not medical causation.',
  },
  quality: { has_errors: false, has_warnings: false, warnings: [], errors: [] },
  uncertainty: {
    max_prob: 0.61,
    prediction_margin: 0.43,
    predictive_entropy: 1.42,
    entropy_norm: 0.58,
    available: true,
    calibration_status: 'unsupported_by_sample_size',
    note: 'Indicators describe model confidence patterns, not clinical certainty.',
  },
  disclaimer: 'MEDGUARD IS A RESEARCH PROTOTYPE. This output must NOT be used for clinical decision-making.',
};

/** Install a fetch stub that answers `/api/predict` with the mock payload. */
export function mockPredictFetch(response = MOCK_PREDICT_RESPONSE, ok = true) {
  const calls = [];
  global.fetch = vi.fn(async (url, options) => {
    calls.push({ url, options, body: options?.body ? JSON.parse(options.body) : null });
    return {
      ok,
      status: ok ? 200 : 500,
      headers: { get: () => 'application/json' },
      json: async () => response,
      text: async () => JSON.stringify(response),
    };
  });
  return calls;
}
