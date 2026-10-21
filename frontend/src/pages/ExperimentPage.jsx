import { useEffect, useState } from 'react';
import { Beaker } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { apiFetch, apiFetchOptional } from '../lib/api';
import { PageShell, SectionCard, LoadingState } from '../components/ui/states';

export default function ExperimentPage() {
  const [exps, setExps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: 'benchmark-1', model_name: 'random_forest' });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await apiFetchOptional('/api/experiments');
      if (!cancelled) {
        setExps(Array.isArray(data) ? data : []);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const result = await apiFetch('/api/experiments/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!result.ok) {
        setError(result.error?.message || 'Experiment rejected');
        return;
      }
      const data = await apiFetchOptional('/api/experiments');
      setExps(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Experiment run failed — check server logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageShell
        title="Experiment workspace"
        subtitle="Submit a supported model configuration for evaluation. Runs are local-only and cannot modify the canonical baseline."
        breadcrumb="Advanced Analysis · Experiments"
      />

      <SectionCard title="Run a new experiment" badge="Local execution">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2 block">Experiment name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-3 rounded-lg border border-border bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary text-sm font-medium" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2 block">Model family</label>
            <select value={form.model_name} onChange={e => setForm({ ...form, model_name: e.target.value })} className="w-full px-3 py-3 rounded-lg border border-border bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary text-sm font-medium">
              <option value="random_forest">Random Forest</option>
              <option value="logistic_regression">Logistic Regression</option>
              <option value="dummy">Dummy Classifier</option>
            </select>
          </div>
          <div className="flex items-end">
            <button disabled={loading} onClick={run} className="w-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-5 py-3 rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Running…' : 'Run experiment'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-xl border border-error/20 bg-error-bg p-3 text-xs text-error">
            {error}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Experiment history" badge={`${exps.length} run${exps.length !== 1 ? 's' : ''}`} icon={<Beaker className="w-4 h-4" />}>
        {exps.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-surface-lift text-muted flex items-center justify-center">
              <span className="text-[24px]">🧪</span>
            </div>
            <div className="text-sm font-medium text-primary mt-3">No experiments yet</div>
            <div className="text-[10px] text-muted mt-1">Submit a configuration above to get started.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-3 pr-3 font-medium">ID</th>
                  <th className="py-3 pr-3 font-medium">Name</th>
                  <th className="py-3 pr-3 font-medium">Status</th>
                  <th className="py-3 pr-3 font-medium text-right">Model</th>
                  <th className="py-3 pr-3 font-medium text-right">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exps.map((e, i) => (
                  <tr key={i}>
                    <td className="py-3 pr-3 font-mono font-medium text-secondary">{e.id}</td>
                    <td className="py-3 pr-3 font-medium text-primary">{e.name}</td>
                    <td className="py-3 pr-3 text-right">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${e.status === 'completed' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'} px-2 py-0.5 rounded`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 font-mono text-secondary">{e.config?.model_name ?? '—'}</td>
                    <td className="py-3 pr-3 text-right font-mono text-secondary">{new Date(e.started_at ?? 0).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
