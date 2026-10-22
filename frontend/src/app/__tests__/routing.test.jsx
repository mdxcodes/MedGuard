import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, memoryStorage } from '../../test/helpers';
import { MODE_RESEARCH, MODE_STORAGE_KEY } from '../../lib/modeStorage';
import { TRANSITION_MS } from '../ModeProvider';

const flushTransition = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TRANSITION_MS + 80));
  });
};

describe('Routing — patient mode', () => {
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

  it('renders the patient home page by default', async () => {
    renderApp({ route: '/', storage: memoryStorage() });
    expect(
      await screen.findByRole('heading', { name: /Understand your assessment results/i }),
    ).toBeInTheDocument();
  });

  it('renders the patient assessment page', async () => {
    renderApp({ route: '/assessment', storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: /New assessment/i })).toBeInTheDocument();
  });

  it('renders the patient result page', async () => {
    renderApp({ route: '/result', storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: /No result to show yet/i })).toBeInTheDocument();
  });

  it('renders the patient about page', async () => {
    renderApp({ route: '/about', storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: /About MedGuard/i })).toBeInTheDocument();
  });

  it('shows a useful not-found state for an unknown route', async () => {
    renderApp({ route: '/does-not-exist', storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: /does not exist/i })).toBeInTheDocument();
  });
});

describe('Routing — research lab', () => {
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

  it('activates Research Lab for a direct research URL', async () => {
    const storage = memoryStorage();
    renderApp({ route: '/explain', storage });

    // The research navigation only exists in the research shell.
    expect(await screen.findByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(storage.getItem(MODE_STORAGE_KEY)).toBe(MODE_RESEARCH);
    });
  });

  it('renders the research overview at / in research mode', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/', storage });
    expect(await screen.findByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
  });

  it.each([
    ['/performance', /Model performance/i, 1],
    ['/dataset', /Dataset explorer/i, 1],
    ['/methodology', /^Methodology$/i, 1],
    ['/errors', /Error analysis workbench/i, 1],
    ['/registry', /Model registry/i, 1],
    ['/triagegeist', /Synthetic benchmark|Benchmark unavailable/i, 1],
  ])('keeps the research page %s functional', async (route, heading, level) => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route, storage });
    expect(await screen.findByRole('heading', { name: heading, level })).toBeInTheDocument();
  });

  it('redirects the legacy /prediction path to /result', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/prediction', storage });
    expect(await screen.findByRole('heading', { name: /Prediction analysis/i })).toBeInTheDocument();
  });
});

describe('Routing — mode switching', () => {
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

  it('moves the visitor to a route that exists in the destination mode', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderApp({ route: '/performance', storage });

    // A research-only URL activates research mode.
    await screen.findByRole('navigation', { name: /Research navigation/i });

    await user.click(screen.getByRole('radio', { name: 'Patient Mode' }));
    await flushTransition();

    // The patient shell is rendered, and the visitor is not left on a page
    // that does not exist in Patient Mode.
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /Research navigation/i })).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole('heading', { name: /Understand your assessment results/i }),
    ).toBeInTheDocument();
  });

  it('keeps the shared routes in place across a mode switch', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderApp({ route: '/assessment', storage });

    await user.click(screen.getByRole('radio', { name: 'Research Lab' }));
    await flushTransition();

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
    });
    // The research assessment page is rendered, not the patient one.
    expect(await screen.findByLabelText('Triage assessment form')).toBeInTheDocument();
  });

  it('does not flash the wrong shell: the persisted mode is used on the first render', () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/', storage });
    // Synchronously, before any effect has run, the research shell is present.
    expect(screen.getByRole('navigation', { name: /Research navigation/i })).toBeInTheDocument();
  });
});
