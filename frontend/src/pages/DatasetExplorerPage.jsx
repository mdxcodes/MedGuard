import { Link } from 'react-router-dom';
import { Database, AlertTriangle, Info, BarChart3, ShieldCheck } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard, StatMetric, EmptyState } from '../components/ui/states';
import datasetProfile from '../../../reports/triagegeist/dataset_profile.json';
import benchmarkResults from '../../../reports/triagegeist/benchmark_results.json';

export default function DatasetExplorerPage() {
  const profile = datasetProfile || {};
  const benchmark = benchmarkResults || {};
  const dist = profile?.target_distribution || {};
  const rowCounts = profile?.row_counts || {};
  const total = rowCounts?.modelling_rows ?? 1;

  return (
    <div className="space-y-8">
      <PageShell
        title="Dataset explorer"
        subtitle="Aggregate statistics from the Triagegeist synthetic dataset. Raw patient records are not displayed — all values come from versioned research reports."
        breadcrumb="Research · Dataset Explorer"
      />

      {/* Overview */}
      <SectionCard title="Dataset overview" badge="Triagegeist synthetic · Research use only">
        <div className="grid sm:grid-cols-4 gap-4">
          <StatMetric value={formatNumber(rowCounts.modelling_rows)} label="Modelling rows" subtitle="Training dataset" tone="primary" />
          <StatMetric value={formatNumber(rowCounts.train_patients)} label="Train patients" subtitle="Grouped split prevents leakage" tone="primary" />
          <StatMetric value={formatNumber(rowCounts.test_rows)} label="Test rows" subtitle="Held out" tone="warning" />
          <StatMetric value={formatNumber(rowCounts.test_patients)} label="Test patients" subtitle="Held out" tone="warning" />
        </div>
        <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
          Triagegeist is a synthetic dataset. Aggregate statistics only — no patient identifiers exposed.
        </div>
      </SectionCard>

      {/* Class distribution */}
      <SectionCard title="ESI class distribution (training)" badge={`n = ${formatNumber(total)}`} icon={<BarChart3 className="w-4 h-4" />}>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(lvl => {
            const count = dist[`ESI ${lvl}`] ?? 0;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={lvl} className="rounded-lg p-3 text-center bg-surface border border-border">
                <div className="text-2xl font-extrabold text-primary">{count}</div>
                <div className="text-[10px] font-mono text-muted mt-1">ESI {lvl}</div>
                <div className="text-[10px] font-mono text-muted">{pct}%</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
          All five ESI levels are represented; the rarest level (ESI 1) has comparatively few examples, so its per-class metrics are the least stable.
        </div>
      </SectionCard>

      {/* Benchmark results */}
      {Object.keys(benchmark).length > 0 && (
        <SectionCard title="Model benchmarks" badge="Validation holdout" icon={<BarChart3 className="w-4 h-4" />}>
          <div className="grid sm:grid-cols-3 gap-4 mt-3">
            {[['dummy', 'Dummy baseline'], ['logistic_regression', 'Logistic Regression'], ['random_forest', 'Random Forest']].map(([key, label]) => {
              const m = benchmark?.model_results?.[key];
              if (!m) return null;
              return (
                <div key={key} className="rounded-lg p-3 text-center bg-surface border border-border">
                  <div className="text-2xl font-extrabold text-primary">{m.balanced_accuracy?.toFixed(3)}</div>
                  <div className="text-[10px] font-mono text-muted mt-1">{label}</div>
                  <div className="text-[10px] font-mono text-muted">BA {m.macro_f1?.toFixed(3)}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Missing data */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <SectionCard title="Missing data (% of modelling rows)" badge="Per feature" icon={<AlertTriangle className="w-4 h-4" />}>
            <div className="space-y-2.5">
              {Object.entries(profile?.missing_percent || {}).map(([feature, pct]) => {
                const v = Number(pct);
                return (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-40 text-[11px] font-medium text-secondary truncate">{feature}</div>
                    <div className="flex-1 h-2 bg-surface-lift rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v > 10 ? 'bg-warning' : v > 5 ? 'bg-warning/60' : 'bg-primary'}`} style={{ width: `${Math.min(v, 100)}%` }} />
                    </div>
                    <div className="w-14 text-right text-[10px] font-mono text-secondary tabular-nums">{v.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-6">
          <SectionCard title="Feature summaries" badge="Vitals & context" icon={<BarChart3 className="w-4 h-4" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="py-2 pr-3 font-medium">Feature</th>
                    <th className="py-2 pr-3 font-medium text-right">n valid</th>
                    <th className="py-2 pr-3 font-medium text-right">Median</th>
                    <th className="py-2 pr-3 font-medium text-right">Mean</th>
                    <th className="py-2 pr-3 font-medium text-right">Min</th>
                    <th className="py-2 pr-3 font-medium text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(profile?.feature_stats || {}).map(([feature, s]) => (
                    <tr key={feature}>
                      <td className="py-2 pr-3 font-medium text-primary">{feature}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.n_valid?.toFixed(0) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.median?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.mean?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.min?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.max?.toFixed(2) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Preprocessing transparency */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Preprocessing transparency" badge="Leakage-safe" icon={<ShieldCheck className="w-4 h-4" />}>
            <ul className="space-y-2 text-sm text-secondary leading-relaxed">
              <li><strong className="text-primary">Temperature:</strong> C/F detection and conversion; out-of-envelope values become missing; missingness indicator added.</li>
              <li><strong className="text-primary">Vitals & BP:</strong> Range validation and consistency checks; missingness indicators added.</li>
              <li><strong className="text-primary">Pain:</strong> Parsed from numeric and sentinel tokens; non-numeric/out-of-range become missing with indicator.</li>
              <li><strong className="text-primary">Chief complaint:</strong> Normalized; TF-IDF (train-fitted, max_features=200, stopwords removed).</li>
              <li><strong className="text-primary">Categoricals:</strong> Arrival transport one-hot encoded (handle_unknown='ignore').</li>
              <li><strong className="text-primary">Imputation/scaling:</strong> Median impute + StandardScaler via ColumnTransformer.</li>
              <li><strong className="text-primary">Leakage control:</strong> Patient-grouped splits; preprocessing fit only on training data.</li>
            </ul>
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Class imbalance & limitations" badge="Read first" icon={<AlertTriangle className="w-4 h-4" />}>
            <ul className="space-y-2 text-sm text-warning-foreground leading-relaxed">
              <li><strong className="text-primary">Severe imbalance:</strong> ESI 3 dominates the cohort.</li>
              <li><strong className="text-primary">Rarest class:</strong> ESI 1 has the fewest examples — per-class metrics are least stable there.</li>
              <li><strong className="text-primary">All levels present:</strong> every ESI level from 1 to 5 has labelled examples, so no level is structurally unlearnable.</li>
              <li><strong className="text-primary">Synthetic cohort:</strong> {formatNumber(total)} visits demonstrates methodology, not clinical performance.</li>
              <li><strong className="text-primary">Not clinically validated:</strong> Research prototype only.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function formatNumber(n) {
  return n == null ? '—' : n.toLocaleString();
}
