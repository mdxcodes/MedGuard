import { Activity } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { PageShell, SectionCard, StatMetric, LoadingState } from '../components/ui/states';

export default function DriftPage() {
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch('/api/drift');
        if (!result.ok) {
          setError(result.error?.message || 'Failed to load drift analysis.');
          return;
        }
        if (!cancelled) setDrift(result.data);
      } catch (e) {
        if (!cancelled) setError('Failed to load drift analysis.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState message="Loading drift analysis…" />;
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Drift analysis unavailable</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const psi = drift?.numeric_psi ?? {};
  const sizes = drift?.sample_sizes ?? {};
  const features = Object.entries(psi)
    .map(([feature, value]) => ({ feature, psi: typeof value === 'number' ? value : 0 }))
    .sort((a, b) => b.psi - a.psi);

  const highDrift = features.filter(f => f.psi > 0.1);
  const maxPsi = features.length > 0 ? Math.max(...features.map(f => f.psi)) : 0;

  return (
    <div className="space-y-8">
      <PageShell
        title="Dataset shift & drift analysis"
        subtitle="Population Stability Index (PSI) between the Triagegeist big training split (80 000 visits) and the holdout partition. Drift is a measurement, not proof of degraded clinical performance."
        breadcrumb="Advanced Analysis · Dataset Drift"
      />

      {/* Status summary */}
      <SectionCard title="Analysis status" badge="Reference vs comparison">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Reference</div>
            <div className="text-lg font-extrabold text-primary">Training split</div>
            <div className="text-[10px] text-muted mt-1 font-mono">Triagegeist big training · {sizes.ref?.toLocaleString() ?? '—'} patients</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Comparison</div>
            <div className="text-lg font-extrabold text-primary">Holdout split</div>
            <div className="text-[10px] text-muted mt-1 font-mono">Patient-grouped partition · {sizes.comp?.toLocaleString() ?? '—'} patients</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Result</div>
            <div className={`text-lg font-extrabold ${highDrift.length > 0 ? 'text-warning' : 'text-primary'}`}>
              {highDrift.length > 0 ? 'Signals detected' : 'Within tolerance'}
            </div>
            <div className="text-[10px] text-muted mt-1 font-mono">{maxPsi.toFixed(4)} max PSI</div>
          </div>
        </div>
      </SectionCard>

      {/* Top drift features */}
      <SectionCard title="Top drift features (by PSI)" badge="Population Stability Index">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-3 pr-3 font-medium">Feature</th>
                <th className="py-3 pr-3 font-medium text-right">PSI</th>
                <th className="py-3 pr-3 font-medium text-right">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {features.slice(0, 10).map((f) => {
                const sev = f.psi > 0.25 ? 'High' : f.psi > 0.1 ? 'Moderate' : 'Low';
                const sevColor = f.psi > 0.25 ? 'text-error' : f.psi > 0.1 ? 'text-warning' : 'text-success';
                return (
                  <tr key={f.feature}>
                    <td className="py-3 pr-3 font-mono font-medium text-primary">{f.feature}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{f.psi.toFixed(4)}</td>
                    <td className="py-3 pr-3 text-right">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${sevColor === 'text-error' ? 'bg-error-bg' : sevColor === 'text-warning' ? 'bg-warning-bg' : 'bg-success-bg'} text-${sevColor}`}>
                        {sev}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="rounded-xl border border-border bg-surface-lift p-5">
        <div className="flex items-start gap-3">
          <Activity className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-secondary leading-relaxed">
            <p className="font-semibold text-primary mb-1">How to read drift</p>
            <p>
              PSI measures distribution differences between reference and comparison sets. Values below 0.1 generally
              indicate negligible shift; 0.1–0.25 moderate; above 0.25 significant. This compares two patient-grouped
              partitions of the same Triagegeist big training cohort — differences reflect sampling variation, not
              real-world temporal or hospital-to-hospital drift.
            </p>
            <p className="mt-2">Drift measures distribution differences only — it does not imply clinical performance degradation.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
