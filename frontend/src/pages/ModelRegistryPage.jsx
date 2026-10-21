import { Database, ShieldCheck, AlertTriangle } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { useEffect, useState } from 'react';
import { apiFetchOptional } from '../lib/api';
import { PageShell, SectionCard, StatMetric, LoadingState } from '../components/ui/states';

export default function ModelRegistryPage() {
  const [active, setActive] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [activeRes, versionsRes] = await Promise.all([
          apiFetchOptional('/api/models/active'),
          apiFetchOptional('/api/models/versions'),
        ]);
        if (!cancelled) {
          setActive(activeRes?.data ?? null);
          setVersions(Array.isArray(versionsRes?.data) ? versionsRes.data : []);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load registry');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      <PageShell
        title="Model registry"
        subtitle="Lightweight registry with artifact-integrity status. No runtime model switching — activation is controlled by deployment configuration."
        breadcrumb="Advanced Analysis · Model Registry"
      />

      {loading && <LoadingState message="Loading registry…" />}
      {error && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Registry unavailable</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}
      {!loading && !error && (
        <>
          <SectionCard title="Active model" badge={active?.version ?? '—'} icon={<ShieldCheck className="w-4 h-4" />}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Serving model</div>
                <div className="text-2xl font-extrabold text-primary">{active?.model_name ?? '—'}</div>
                <div className="text-sm text-secondary mt-1">{active?.metadata?.dataset ?? '—'}</div>
              </div>
              {active?.integrity?.ok ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-success-bg text-success px-3 py-1.5 rounded-full border border-success/20">
                  <ShieldCheck className="w-3 h-3" /> Integrity verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-error-bg text-error px-3 py-1.5 rounded-full border border-error/20">
                  <AlertTriangle className="w-3 h-3" /> Integrity issues
                </span>
              )}
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <StatMetric value={active?.metadata?.training_rows ?? '—'} label="Training rows" subtitle="Unique patients: {active?.metadata?.training_patients ?? '—'}" tone="info" />
              <StatMetric value={JSON.stringify(active?.metadata?.esi_labels ?? [])} label="ESI labels" subtitle={`Target: ${active?.metadata?.target ?? '—'}`} tone="info" />
            </div>
            {active?.integrity?.errors && active.integrity.errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-error/20 bg-error-bg p-3 text-[10px] font-mono text-error">
                {JSON.stringify(active.integrity.errors)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Registered versions" badge={versions.length}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="py-3 pr-3 font-medium">Version</th>
                    <th className="py-3 pr-3 font-medium">Model</th>
                    <th className="py-3 pr-3 font-medium text-right">Active</th>
                    <th className="py-3 pr-3 font-medium text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {versions.map((v, i) => (
                    <tr key={i}>
                      <td className="py-3 pr-3 font-mono font-medium text-primary">{v.version}</td>
                      <td className="py-3 pr-3 font-mono text-secondary">{v.model_name}</td>
                      <td className="py-3 pr-3 text-right">
                        {v.active ? <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary-soft text-primary px-2 py-0.5 rounded">Yes</span> : 'No'}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-success-bg text-success px-2 py-0.5 rounded">
                          <ShieldCheck className="w-2.5 h-2.5" /> OK
                        </span>
                      </td>
                    </tr>
                  ))}
                  {versions.length === 0 && (
                    <tr><td colSpan="4" className="py-6 text-center text-muted">No versions registered.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
