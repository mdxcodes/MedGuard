import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, memoryStorage, mockPredictFetch, MOCK_PREDICT_RESPONSE } from '../../../test/helpers';
import { MODE_RESEARCH, MODE_STORAGE_KEY } from '../../../lib/modeStorage';
import { TRANSITION_MS } from '../../../app/ModeProvider';

const flushTransition = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 80));
  });
};

describe('Patient assessment wizard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('preserves form values when moving between steps', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });

    await user.type(screen.getByLabelText(/^Age/), '58');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2 is rendered, and the value entered in step 1 is still there.
    expect(await screen.findByRole('heading', { name: /How the person is feeling/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByLabelText(/^Age/)).toHaveValue(58);
  });

  it('shows a review step with the entered values before submitting', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '58');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByRole('heading', { name: /^Review$/i })).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    // The fields that were left blank are listed, not silently dropped.
    expect(screen.getByRole('heading', { name: /Not provided/i })).toBeInTheDocument();
  });

  it('sends the correct field names and values to the API', async () => {
    const user = userEvent.setup();
    const calls = mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '58');

    // Walk to the review step, entering a pain score on the way.
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.type(screen.getByLabelText(/^Pain level/), '6');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });

    await user.click(screen.getByRole('button', { name: /See my result/i }));

    const predictions = () => calls.filter((call) => String(call.url).includes('/api/predict'));
    await waitFor(() => expect(predictions()).toHaveLength(1));
    const body = predictions()[0].body;
    expect(body.age).toBe(58);
    expect(body.pain_score).toBe(6);
    // Fields that were left blank are omitted, never guessed.
    expect('heart_rate' in body).toBe(false);
    expect('spo2' in body).toBe(false);
    // Only contract fields are sent.
    expect(Object.keys(body).every((key) =>
      ['age', 'sex', 'insurance_type', 'chief_complaint_system', 'pain_score',
        'arrival_mode', 'heart_rate', 'respiratory_rate', 'temperature_c', 'spo2',
        'systolic_bp', 'diastolic_bp', 'arrival_hour', 'num_prior_ed_visits_12m',
        'num_active_medications', 'shock_index'].includes(key),
    )).toBe(true);
  });

  it('shows the result of the actual API response and does not predict again', async () => {
    const user = userEvent.setup();
    const calls = mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '58');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    // The result page shows the level the API returned.
    expect(await screen.findByRole('heading', { name: /Your assessment result/i })).toBeInTheDocument();
    expect(screen.getAllByText(/ESI 3/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Urgent/)).toBeInTheDocument();

    // Exactly one prediction request was made.
    expect(calls.filter((call) => String(call.url).includes('/api/predict'))).toHaveLength(1);
  });

  it('does not fabricate a result when the backend fails', async () => {
    const user = userEvent.setup();
    mockPredictFetch({ detail: 'backend unavailable' }, false);
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    // The failure is reported and a retry is offered; no result is shown.
    expect(await screen.findByText(/could not be run/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
    expect(screen.queryByText(/ESI 3/)).not.toBeInTheDocument();
  });

  it('rejects a value outside the range the model accepts', async () => {
    const user = userEvent.setup();
    const calls = mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '999');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    expect(await screen.findByText(/could not be run/i)).toBeInTheDocument();
    expect(calls.filter((call) => String(call.url).includes('/api/predict'))).toHaveLength(0);
  });
});

describe('Shared assessment state across modes', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the entered values when the mode changes', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '58');

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await flushTransition();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
    });
    // The research form shows the same value.
    await waitFor(() => {
      expect(screen.getByLabelText('Age')).toHaveValue(58);
    });
  });

  it('shows the same result in both modes', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.type(screen.getByLabelText(/^Age/), '58');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    await screen.findByRole('heading', { name: /Your assessment result/i });
    expect(screen.getAllByText(/ESI 3/).length).toBeGreaterThan(0);

    // Switch to Research Lab: the same stored result is rendered there.
    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await flushTransition();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Prediction analysis/i })).toBeInTheDocument();
    });
    expect(screen.getAllByText(/ESI 3/).length).toBeGreaterThan(0);
  });
});

describe('Patient result — integrity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows an empty state rather than a hardcoded example when no result exists', async () => {
    renderApp({ route: '/result', storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: /No result to show yet/i })).toBeInTheDocument();
    expect(screen.queryByText(/ESI 1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ESI 5/)).not.toBeInTheDocument();
  });

  it('does not expose raw SHAP arrays or internal API JSON in the patient result', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    await screen.findByRole('heading', { name: /Your assessment result/i });

    // The raw explanation payload is not dumped into the page.
    expect(screen.queryByText(/shap_value/)).not.toBeInTheDocument();
    expect(screen.queryByText(/explanation_status/)).not.toBeInTheDocument();
    // The disclaimer from the API is present.
    expect(screen.getByText(/RESEARCH PROTOTYPE/)).toBeInTheDocument();
  });

  it('never claims the result is a diagnosis', async () => {
    const user = userEvent.setup();
    mockPredictFetch();
    renderApp({ route: '/assessment', storage: memoryStorage() });

    await screen.findByRole('heading', { name: /New assessment/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /How the person is feeling/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /Available measurements/i });
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByRole('heading', { name: /^Review$/i });
    await user.click(screen.getByRole('button', { name: /See my result/i }));

    await screen.findByRole('heading', { name: /Your assessment result/i });
    expect(screen.getByText(/not a clinical determination/i)).toBeInTheDocument();
    expect(screen.getByText(/not a medical assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/seek emergency help now/i)).toBeInTheDocument();
  });
});
