import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';

/**
 * Model and API status.
 *
 * The status is polled once per session and shared, so switching modes does
 * not re-issue the health and model-info requests. The provider lives above
 * the mode-dependent shell, so it survives a mode switch.
 *
 * The two states are deliberately separate. A reachable API that has no model
 * artifact loaded is a *different* situation from an unreachable API, and
 * reporting them with one word makes a healthy service look broken.
 *
 *   apiStatus   'ok'      the API answered /health
 *               'error'   the API could not be reached
 *               'unknown' not polled yet
 *
 *   modelStatus 'ready'      the model is loaded and can serve predictions
 *               'not-loaded' the API is up, but the model artifact is absent
 *               'error'      the model state could not be determined
 *               'unknown'    not polled yet
 */

const ModelStatusContext = createContext(null);

export function ModelStatusProvider({ children }) {
  const [apiStatus, setApiStatus] = useState('unknown'); // 'ok' | 'error' | 'unknown'
  const [modelStatus, setModelStatus] = useState('unknown'); // 'ready' | 'not-loaded' | 'error' | 'unknown'

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const health = await apiFetch('/api/health');
      if (cancelled) return;
      // /health answers 200 as long as the process is serving.
      setApiStatus(health.ok ? 'ok' : 'error');

      const modelInfo = await apiFetch('/api/model-info');
      if (cancelled) return;

      if (modelInfo.ok) {
        setModelStatus('ready');
        return;
      }

      // 503 is the service telling us it is up but has no artifact. That is a
      // different condition from the API being unreachable, and the two must
      // not be reported with the same word.
      if (modelInfo.error?.status === 503) {
        setModelStatus('not-loaded');
      } else {
        setModelStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      apiStatus,
      modelStatus,
      // Kept for compatibility with existing consumers: the model is usable
      // only when it is actually loaded.
      modelReady: modelStatus === 'ready',
    }),
    [apiStatus, modelStatus],
  );

  return <ModelStatusContext.Provider value={value}>{children}</ModelStatusContext.Provider>;
}

export function useModelStatus() {
  const context = useContext(ModelStatusContext);
  if (!context) {
    throw new Error('useModelStatus must be used inside a ModelStatusProvider');
  }
  return context;
}
