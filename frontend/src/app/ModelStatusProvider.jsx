import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetchOptional } from '../lib/api';

/**
 * Model and API status.
 *
 * The status is polled once per session and shared, so switching modes does
 * not re-issue the health and model-info requests. The provider lives above
 * the mode-dependent shell, so it survives a mode switch.
 */

const ModelStatusContext = createContext(null);

export function ModelStatusProvider({ children }) {
  const [apiStatus, setApiStatus] = useState('unknown'); // 'ok' | 'error' | 'unknown'
  const [modelReady, setModelReady] = useState('unknown'); // 'ready' | 'unavailable' | 'unknown'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const health = await apiFetchOptional('/api/health');
      if (!cancelled) setApiStatus(health ? 'ok' : 'error');

      const modelInfo = await apiFetchOptional('/api/model-info');
      if (!cancelled) setModelReady(modelInfo ? 'ready' : 'unavailable');
    })();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ apiStatus, modelReady }), [apiStatus, modelReady]);
  return <ModelStatusContext.Provider value={value}>{children}</ModelStatusContext.Provider>;
}

export function useModelStatus() {
  const context = useContext(ModelStatusContext);
  if (!context) {
    throw new Error('useModelStatus must be used inside a ModelStatusProvider');
  }
  return context;
}
