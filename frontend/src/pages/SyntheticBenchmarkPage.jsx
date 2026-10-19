import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function SyntheticBenchmarkPage() {
  const [modelInfo, setModelInfo] = useState(null);
  const [triagegeist, setTriagegeist] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const info = await apiFetch('/model-info');
        setModelInfo(info);
        try {
          const tg = await apiFetch('/triagegeist/status');
          setTriagegeist(tg);
        } catch (ignored) {
          setTriagegeist(null);
        }
      } catch (e) {
        setError(String(e?.message ?? e));
      }
    })();
  }, []);

  if (error) {
    return (
      <section className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Triagegeist Benchmark</h1>
        <p className="text-sm text-text-muted mb-6">Synthetic benchmark status could not be loaded.</p>
        <pre className="text-xs bg-surface-2 p-4 rounded border border-border-subtle overflow-auto">{error}</pre>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Triagegeist Benchmark</h1>
        <p className="text-sm text-text-muted mt-1">
          Research-only benchmark over the Triagegeist synthetic dataset. Results here are separated from the
          real-data MIMIC-IV-ED baseline and must not be presented as clinically comparable.
        </p>
      </div>

      {triagegeist ? (
        <div>
          <h2 className="text-lg font-semibold mb-2">Benchmark status</h2>
          <pre className="text-xs bg-surface-2 p-4 rounded border border-border-subtle overflow-auto">
            {JSON.stringify(triagegeist, null, 2)}
          </pre>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-2">Benchmark unavailable</h2>
          <p className="text-sm text-text-muted">
            The Triagegeist benchmark artifacts are not present or the benchmark endpoint is not available in this
            deployment. Synthetic benchmark results are therefore hidden rather than fabricated.
          </p>
        </div>
      )}

      {modelInfo && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Active model context</h2>
          <pre className="text-xs bg-surface-2 p-4 rounded border border-border-subtle overflow-auto">
            {JSON.stringify(modelInfo, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
