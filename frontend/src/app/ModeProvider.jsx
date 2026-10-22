import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_MODE,
  MODE_PATIENT,
  MODE_RESEARCH,
  isValidMode,
  readStoredMode,
  writeStoredMode,
} from '../lib/modeStorage';

/**
 * How long the transition overlay stays up. The whole switch — fade out,
 * overlay, fade in — is designed to land inside the 350–650 ms band.
 */
export const TRANSITION_MS = 420;

/** Messages shown while the destination interface is prepared. */
export const TRANSITION_MESSAGES = {
  [MODE_PATIENT]: 'Preparing Patient Mode…',
  [MODE_RESEARCH]: 'Opening Research Lab…',
};

const ModeContext = createContext(null);

/** True when the visitor asked the OS to reduce motion. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Provides the single authoritative mode state.
 *
 * The mode decides which presentation shell is rendered. It never affects the
 * model, the dataset, the prediction request or any model parameter — both
 * modes call the same `submitAssessment` against the same backend.
 */
export function ModeProvider({ children, storage }) {
  // Read the persisted preference once, before the first paint, so the shell
  // never flashes the wrong interface on reload.
  const [mode, setMode] = useState(() => readStoredMode(storage ?? safeStorage()));
  const [pendingMode, setPendingMode] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());

  const timerRef = useRef(null);
  const switchingRef = useRef(false);

  // Keep the reduced-motion preference live: a visitor can change it while
  // the application is open.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    let query;
    try {
      query = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }
    const onChange = (event) => setReducedMotion(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener?.(onChange);
    return () => query.removeListener?.(onChange);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const commit = useCallback((next) => {
    writeStoredMode(next, storage ?? safeStorage());
    setMode(next);
    setPendingMode(null);
    setTransitioning(false);
    switchingRef.current = false;
  }, [storage]);

  /**
   * Request a mode change.
   *
   * The request is registered immediately (so the control reflects the
   * intent), but the interface swap is held back behind a short transition.
   * Repeated requests while a transition is running are ignored, so the
   * switch can never be double-fired.
   */
  const requestMode = useCallback((next) => {
    if (!isValidMode(next)) return false;
    if (switchingRef.current) return false;
    if (next === mode && !pendingMode) return false;

    switchingRef.current = true;
    setPendingMode(next);
    setTransitioning(true);

    // With reduced motion the swap is immediate: no overlay, no waiting.
    if (prefersReducedMotion()) {
      commit(next);
      return true;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commit(next);
    }, TRANSITION_MS);

    return true;
  }, [commit, mode, pendingMode, storage]);

  /**
   * Change mode without a transition. Used when a direct URL requires a
   * different shell — there is nothing to animate from in that case.
   */
  const setModeImmediately = useCallback((next) => {
    if (!isValidMode(next)) return;
    writeStoredMode(next, storage ?? safeStorage());
    setMode(next);
    setPendingMode(null);
    setTransitioning(false);
    switchingRef.current = false;
  }, [storage]);

  const value = useMemo(() => ({
    mode,
    pendingMode: pendingMode || mode,
    transitioning,
    reducedMotion,
    requestMode,
    setModeImmediately,
    transitionMessage: TRANSITION_MESSAGES[pendingMode || mode],
  }), [mode, pendingMode, transitioning, reducedMotion, requestMode, setModeImmediately]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used inside a ModeProvider');
  }
  return context;
}

/** localStorage, guarded — it throws in some privacy modes. */
function safeStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export { DEFAULT_MODE, MODE_PATIENT, MODE_RESEARCH };
