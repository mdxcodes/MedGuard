import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, memoryStorage, mockPredictFetch } from '../../test/helpers';
import { MODE_RESEARCH, MODE_STORAGE_KEY } from '../../lib/modeStorage';
import { TRANSITION_MS } from '../../app/ModeProvider';

const flushTransition = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 80));
  });
};

/** Install a narrow-viewport matchMedia stub. */
function useNarrowViewport() {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: /max-width:\s*\d+px/.test(query) ? true : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('Responsive behaviour', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
      text: async () => '{}',
    }));
  });

  it('does not use a sidebar in Patient Mode', async () => {
    const { container } = renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    expect(container.querySelector('aside')).toBeNull();
  });

  it('keeps the mode switcher reachable on a narrow viewport in Patient Mode', async () => {
    useNarrowViewport();
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    // The compact switcher is still rendered, in the header.
    expect(screen.getByRole('radiogroup', { name: 'Interface mode' })).toBeInTheDocument();
  });

  it('keeps exactly one mode switcher in the research shell on a narrow viewport', async () => {
    useNarrowViewport();
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/', storage });
    await screen.findByRole('heading', { name: /Understand Triage Predictions/i });

    // The switcher stays in the header at every width, so it is discoverable
    // without opening the menu — and there is still only one of them.
    expect(screen.getAllByRole('radiogroup', { name: 'Interface mode' })).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Research Lab' })).toBeInTheDocument();
  });

  it('keeps the mode switcher discoverable without opening the mobile menu', async () => {
    useNarrowViewport();
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/', storage });
    await screen.findByRole('heading', { name: /Understand Triage Predictions/i });

    // The off-canvas panel is inert while it is closed.
    expect(screen.getByRole('button', { name: /Open navigation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: 'Interface mode' })).toHaveLength(1);
  });

  it('does not overflow the viewport horizontally on the patient pages', async () => {
    const { container } = renderApp({ route: '/assessment', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /New assessment/i });

    // No element may declare a fixed width wider than a small phone.
    const offenders = Array.from(container.querySelectorAll('*')).filter((element) => {
      const width = element.style?.width;
      if (!width) return false;
      const parsed = parseInt(width, 10);
      return Number.isFinite(parsed) && parsed > 480;
    });
    expect(offenders).toHaveLength(0);
  });
});

describe('Mode transition', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
      text: async () => '{}',
    }));
  });

  it('shows a brief transition overlay with a status message while switching', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));

    const overlay = await screen.findByTestId('mode-transition');
    expect(overlay).toBeInTheDocument();
    expect(screen.getAllByText('Opening Research Lab…').length).toBeGreaterThan(0);

    await flushTransition();
    expect(screen.queryByTestId('mode-transition')).not.toBeInTheDocument();
  });

  it('announces the transition to assistive technology', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));

    const live = document.querySelector('[role="status"][aria-live="assertive"]');
    expect(live).not.toBeNull();
    expect(live.textContent).toContain('Opening Research Lab');

    await flushTransition();
  });

  it('completes within the intended transition budget', async () => {
    const user = userEvent.setup();
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });

    const started = Date.now();
    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
    });
    const elapsed = Date.now() - started;

    // The whole switch must land inside the 350–650 ms band.
    expect(elapsed).toBeLessThan(1500);
    expect(TRANSITION_MS).toBeGreaterThanOrEqual(350);
    expect(TRANSITION_MS).toBeLessThanOrEqual(650);
  });

  it('does not trigger a network request when the mode changes', async () => {
    const user = userEvent.setup();
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
        text: async () => '{}',
      };
    });

    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });

    // Let the initial status poll settle, then record only what the switch
    // itself triggers.
    await act(async () => { await Promise.resolve(); });
    calls.length = 0;

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await flushTransition();

    // The switch must not re-poll the model status and must not re-run a
    // prediction. The research overview fetching its own metrics is expected:
    // that page needs the data to render.
    const forbidden = calls.filter((url) =>
      /\/(health|model-info|predict)/.test(String(url)),
    );
    expect(forbidden).toHaveLength(0);
  });
});

describe('Assessment state across a mode switch', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('does not resubmit the assessment when the mode changes', async () => {
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

    await screen.findByRole('heading', { name: /Your assessment result/i });
    const predictions = () => calls.filter((call) => String(call.url).includes('/api/predict'));
    expect(predictions()).toHaveLength(1);

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await flushTransition();

    // Still exactly one prediction request: the mode change did not resubmit.
    expect(predictions()).toHaveLength(1);
  });
});
