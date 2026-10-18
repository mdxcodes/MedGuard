import { Database, ShieldCheck, AlertTriangle } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { useEffect, useState } from 'react';

export default function ModelRegistryPage() {
  const [active, setActive] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [a, v] = await Promise.all([
          fetch('/api/models/active').then(r => r.json()),
          fetch('/api/models/versions').then(r => r.json()),
        ]);
        setActive(a);
        setVersions(Array.isArray(v) ? v : [v]);
      } catch (e) {
        setError('Failed to load registry');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-rose-600">{error}</div>;

  const integ = active?.integrity || {};
  const meta = active?.metadata || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-teal" />
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Model Registry</h1>
        </div>
        <p className="text-sm text-text-secondary max-w-3xl">
          Lightweight registry with integrity status. No runtime model switching.
        </p>
      </header>

      <section className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Active Model</h2>
          {integ.ok ? (
            <span className="inline-flex items-center gap-1 text-xs bg-teal-muted/40 text-teal px-2 py-1 rounded border border-teal/20">
              <ShieldCheck className="w-3 h-3" /> Integrity OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-200">
              <AlertTriangle className="w-3 h-3" /> Integrity Issues
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><span className="text-text-muted">Version:</span> <span className="font-mono">{active?.version}</span></div>
          <div><span className="text-text-muted">Model:</span> {active?.model_name}</div>
          <div><span className="text-text-muted">Dataset:</span> {meta.dataset}</div>
          <div><span className="text-text-muted">Training rows/patients:</span> {meta.training_rows}/{meta.training_patients}</div>
          <div><span className="text-text-muted">ESI Labels:</span> {JSON.stringify(meta.esi_labels)}</div>
          <div><span className="text-text-muted">Target:</span> {meta.target}</div>
        </div>
        {integ.errors && integ.errors.length > 0 && (
          <div className="text-xs text-rose-600">{JSON.stringify(integ.errors)}</div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-border shadow-card p-6">
        <h2 className="text-lg font-bold text-navy mb-3">Versions</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-text-muted"><th className="text-left py-2">Version</th><th className="text-left py-2">Model</th><th className="text-left py-2">Active</th></tr></thead>
          <tbody>
            {versions.map((v,i) => (
              <tr key={i} className="border-t border-border-subtle"><td className="py-2 font-mono">{v.version}</td><td className="py-2">{v.model_name}</td><td className="py-2">{v.active ? 'Yes' : 'No'}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
