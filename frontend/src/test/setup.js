import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

// The default 1 s budget for `findBy*` is tight when the suite runs alongside
// a build or a backend test run; the queries are not racing anything.
configure({ asyncUtilTimeout: 5000 });

/**
 * Test environment setup.
 *
 * The frontend has no DOM test environment by default, so the component tests
 * install one here. `matchMedia` is stubbed because jsdom does not implement
 * it and the mode switcher reads the reduced-motion preference from it.
 */

beforeEach(() => {
  // jsdom implements neither matchMedia nor ResizeObserver, and the research
  // charts (recharts) need the latter to size their containers.
  //
  // The stub is reinstalled for every test so a test that changes the
  // viewport cannot leak into the next one. The default is a wide viewport;
  // the reduced-motion query never matches by default.
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: /min-width:\s*\d+px/.test(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  if (!global.ResizeObserver) {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
