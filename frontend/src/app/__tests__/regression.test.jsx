import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp, memoryStorage } from '../../test/helpers';
import { MODE_RESEARCH, MODE_STORAGE_KEY } from '../../lib/modeStorage';
import { RESEARCH_NAV } from '../../components/research/ResearchSidebar';
import { PATIENT_NAV } from '../../components/patient/PatientNav';
import { ROUTES } from '../../lib/modeRoutes';

const RESEARCH_ROUTES = [
  '/', '/assessment', '/result', '/performance', '/methodology', '/dataset',
  '/compare', '/errors', '/explain', '/registry', '/experiments', '/drift',
  '/triagegeist',
];

describe('Regression — research pages remain functional', () => {
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

  it('keeps every research route registered', () => {
    const registered = ROUTES.map((route) => route.path);
    for (const path of RESEARCH_ROUTES) {
      expect(registered).toContain(path);
    }
  });

  it('groups the research navigation without pointing at unimplemented pages', () => {
    const registered = new Set(ROUTES.map((route) => route.path));
    for (const group of RESEARCH_NAV) {
      for (const item of group.items) {
        const [path] = item.path.split('#');
        expect(registered).toContain(path);
      }
    }
  });

  it('keeps the research navigation grouped under the documented headings', () => {
    const labels = RESEARCH_NAV.map((group) => group.label);
    expect(labels).toEqual([
      'Overview',
      'Triagegeist Data',
      'Model Evaluation',
      'Explainability',
      'Experiments',
      'Methodology',
    ]);
  });

  it('renders the research charts and data pages', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/performance', storage });

    // The confusion matrix and the per-class table are both present.
    expect((await screen.findAllByText(/Confusion matrix/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Per-class performance/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cross-validation summary/i).length).toBeGreaterThan(0);
  });

  it('renders the explainability page with the global feature importances', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/explain', storage });
    expect(await screen.findByText(/Mean \|SHAP\| feature importance/i)).toBeInTheDocument();
  });
});

describe('Regression — patient navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers exactly the patient destinations', () => {
    expect(PATIENT_NAV.map((item) => item.label)).toEqual([
      'Home',
      'New Assessment',
      'My Result',
      'My History',
      'About',
    ]);
  });

  it('only offers a history because the backend really stores one', () => {
    // A "My History" entry is legitimate only while the service persists
    // assessments. The backend exposes /history, and the browser never reads
    // the database directly, so the entry reflects real storage rather than a
    // fabricated feature.
    const labels = PATIENT_NAV.map((item) => item.label).join(' ').toLowerCase();
    expect(labels).toContain('history');
    // Nothing may promise previously saved assessments that do not exist.
    expect(labels).not.toContain('previous');
  });
});

describe('Regression — no dead controls or blank screens', () => {
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

  it.each([
    ['/', /Understand your assessment results/i],
    ['/assessment', /New assessment/i],
    ['/result', /No result to show yet/i],
    ['/about', /About MedGuard/i],
  ])('renders patient route %s with content', async (route, heading) => {
    renderApp({ route, storage: memoryStorage() });
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('always exposes a mode switcher in the patient shell', async () => {
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    expect(screen.getByRole('radiogroup', { name: 'Interface mode' })).toBeInTheDocument();
  });

  it('always exposes a mode switcher in the research shell', async () => {
    const storage = memoryStorage({ [MODE_STORAGE_KEY]: MODE_RESEARCH });
    renderApp({ route: '/', storage });
    await screen.findByRole('navigation', { name: /Research navigation/i });
    expect(screen.getByRole('radiogroup', { name: 'Interface mode' })).toBeInTheDocument();
  });
});

describe('Regression — responsible use', () => {
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

  it('states the research-prototype disclaimer on the patient home page', async () => {
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    expect(screen.getByText(/not a medical diagnosis/i)).toBeInTheDocument();
    expect(screen.getByText(/not a substitute for professional medical care/i)).toBeInTheDocument();
  });

  it('points to emergency services on the patient home page', async () => {
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    expect(screen.getAllByText(/seek emergency help now/i).length).toBeGreaterThan(0);
  });

  it('does not promise that waiting is safe', async () => {
    renderApp({ route: '/', storage: memoryStorage() });
    await screen.findByRole('heading', { name: /Understand your assessment results/i });
    const body = document.body.textContent.toLowerCase();
    expect(body).not.toContain('safe to wait at home');
    expect(body).not.toContain('you are safe');
  });
});
