import { useEffect, useState } from 'react';
import { Activity, BarChart3 } from 'lucide-react';
import { AlertTriangle, Info } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard, StatMetric } from '../components/ui/states';
import { apiFetch } from '../lib/api';

/** Display names for the benchmark's model keys. */
const MODEL_LABELS = {
  dummy: 'Dummy (majority class)',
  logistic_regression: 'Logistic regression',
  random_forest: 'Random forest',
};

export default function SyntheticBenchmarkPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetch('/api/triagegeist/status');
      if (!cancelled) {
        if (!result.ok) {
          setError(result.error?.message || 'Failed to load benchmark');
          setStatus('error');
          return;
        }
        const tg = result.data;
        if (tg?.available) {
          setData(tg);
          setStatus('loaded');
        } else {
          setStatus('unavailable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const profile = data?.profile ?? {};
  const results = data?.benchmark_results ?? null;
  const manifest = data?.manifest ?? null;
  const dist = profile?.target_distribution_train ?? profile?.target_distribution ?? {};
  const totalTrain = profile?.train_rows ?? 0;

  return (
    <div className="space-y-8">
      <PageShell
        title="Synthetic benchmark"
        subtitle="Research-only benchmark over the synthetic Triagegeist dataset. Results here are separated from empirical data and must not be presented as clinically comparable."
        breadcrumb="Advanced Analysis · Synthetic Benchmark"
      />

      {error && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Benchmark request failed</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}
      {status === 'unavailable' && (
        <SectionCard title="Benchmark unavailable" badge="Synthetic dataset" icon={<AlertTriangle className="w-4 h-4" />}>
          <p className="text-sm text-secondary">
            Triagegeist benchmark artifacts are not present in this deployment.
          </p>
          <div className="mt-3 rounded-lg border border-border/50 bg-surface-lift p-3 text-[10px] font-mono text-primary-muted">
            Generate the benchmark with `venv/bin/python -m backend.ml.build_reports` to populate the reports directory, then restart the backend.
          </div>
        </SectionCard>
      )}
      {status === 'loading' && <div className="py-8 text-center"><div className="text-sm text-secondary font-mono animate-pulse">Loading benchmark data…</div></div>}
      {status === 'loaded' && (
        <>
          {/* Provenance */}
          <SectionCard id="provenance" title="Dataset provenance" badge="Triagegeist · synthetic">
            <div className="grid sm:grid-cols-4 gap-4">
              <StatMetric value={formatNumber(profile.train_rows)} label="Train rows" subtitle={profile.train_patients != null ? `${formatNumber(profile.train_patients)} patients` : ''} tone="info" />
              <StatMetric value={formatNumber(profile.test_rows)} label="Test rows" subtitle={profile.test_patients != null ? `${formatNumber(profile.test_patients)} patients` : ''} tone="info" />
              <StatMetric value={profile.patient_overlap_train_test ?? '0'} label="Train/test overlap" subtitle="0 = no patient leakage" tone="success" />
              <StatMetric value={profile.reference_dataset ?? '—'} label="Split protocol" subtitle={profile.split_protocol ?? ''} tone="info" />
            </div>
            <div className="mt-3 rounded-lg border border-warning/20 bg-warning-bg/40 p-3 text-[10px] text-warning font-medium">
              Triagegeist is a synthetic dataset. Its metrics are not comparable to empirical data and do not establish clinical validity.
            </div>
          </SectionCard>

          {/* Results */}
          {results && (
            <SectionCard title="Benchmark results (validation holdout)" badge="Models compared on same protocol">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-3 pr-3 font-medium">Model</th>
                      <th className="py-3 pr-3 font-medium text-right">Balanced acc</th>
                      <th className="py-3 pr-3 font-medium text-right">Macro-F1</th>
                      <th className="py-3 pr-3 font-medium text-right">QWK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(results.model_results ?? {}).map(([name, m]) => (
                      <tr key={name} className={`${name === 'random_forest' ? 'bg-primary-soft' : ''}`}>
                        <td className="py-3 pr-3 font-medium text-primary">
                          {MODEL_LABELS[name] ?? name}
                          {name === 'random_forest' && (
                            <span className="ml-2 text-[10px] font-mono text-muted">· selected</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{m.balanced_accuracy?.toFixed(3) ?? '—'}</td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{m.macro_f1?.toFixed(3) ?? '—'}</td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">
                          {m.quadratic_weighted_kappa != null ? m.quadratic_weighted_kappa.toFixed(3) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 pt-3 border-t border-border text-[10px] font-mono text-muted">
                Metrics computed on the validation holdout from train.csv. Test.csv labels are withheld — no test-set metrics reported.
              </div>
            </SectionCard>
          )}

          {/* Class distribution */}
          {Object.keys(dist).length > 0 && (
            <SectionCard title="ESI class distribution (training)" badge={`n = ${formatNumber(totalTrain)}`} icon={<BarChart3 className="w-4 h-4" />}>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(dist).map(([label, count]) => (
                  <div key={label} className="rounded-lg p-3 text-center bg-surface border border-border">
                    <div className="text-2xl font-extrabold text-primary">{formatNumber(count)}</div>
                    <div className="text-[10px] font-mono text-muted mt-1">{label}</div>
                    <div className="text-[10px] font-mono text-muted">{totalTrain > 0 ? ((count / totalTrain) * 100).toFixed(1) + '%' : '0.0%'}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Released files */}
          {profile?.file_inventory && Object.keys(profile.file_inventory).length > 0 && (
            <SectionCard title="Released files" badge="Triagegeist">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-muted border-b border-border">
                      <th className="py-3 pr-3 font-medium">File</th>
                      <th className="py-3 pr-3 font-medium text-right">Rows</th>
                      <th className="py-3 pr-3 font-medium text-right">Labels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(profile.file_inventory).map(([file, info]) => (
                      <tr key={file}>
                        <td className="py-3 pr-3 font-mono text-primary">{file}</td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">
                          {formatNumber(info.rows)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-[10px] text-muted">
                          {info.has_labels === true ? 'included' : info.has_labels === false ? 'withheld' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Reproducibility */}
          {manifest && (
            <SectionCard title="Reproducibility" badge="Run manifest" icon={<Activity className="w-4 h-4" />}>
              <div className="grid sm:grid-cols-2 gap-4">
                <StatMetric
                  value={manifest.random_seed ?? '—'}
                  label="Random seed"
                  subtitle="Drives the split, the estimator and the CV shuffle"
                  tone="info"
                />
                <StatMetric
                  value={manifest.target ?? '—'}
                  label="Target"
                  subtitle={
                    manifest.esi_labels?.length
                      ? `ESI levels ${manifest.esi_labels[0]}–${manifest.esi_labels[manifest.esi_labels.length - 1]}`
                      : ''
                  }
                  tone="info"
                />
              </div>
              {manifest.generated_at_utc && (
                <p className="mt-3 text-[10px] font-mono text-muted">
                  Artifacts generated {manifest.generated_at_utc}
                </p>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

function formatNumber(n) {
  return n == null ? '—' : n.toLocaleString();
}
