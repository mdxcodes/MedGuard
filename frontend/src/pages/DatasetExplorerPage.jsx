import { Link } from 'react-router-dom';
import { Database, AlertTriangle, Info, BarChart3 } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard, StatMetric, EmptyState } from '../components/ui/states';
import dataQuality from '../../../reports/data_quality_report.json';
import modelEval from '../../../reports/model_evaluation.json';

export default function DatasetExplorerPage() {
  const classDist = dataQuality.label_distribution || {};
  const missing = dataQuality.missing_percent || {};
  const featStats = dataQuality.feature_stats || {};
  const rowCounts = dataQuality.row_counts || {};
  const features = Object.keys(featStats).sort();
  const total = rowCounts.modelling_rows || 1;

  return (
    <div className="space-y-8">
      <PageShell
        title="Dataset explorer"
        subtitle="Aggregate statistics from the audited MIMIC-IV-ED v2.2 demo subset. Raw patient records are not displayed — all values come from versioned research reports."
        breadcrumb="Research · Dataset Explorer"
      />

      {/* Overview */}
      <SectionCard title="Dataset overview" badge="MIMIC-IV-ED v2.2 · ODbL licensed">
        <div className="grid sm:grid-cols-4 gap-4">
          <StatMetric value={formatNumber(rowCounts.modelling_rows)} label="Modelling rows" subtitle="From joined dataset" tone="primary" />
          <StatMetric value={formatNumber(modelEval.n_patients)} label="Unique patients" subtitle="Grouped split prevents leakage" tone="primary" />
          <StatMetric value={formatNumber(rowCounts.train_patients)} label="Train patients" subtitle="GroupShuffleSplit" tone="primary" />
          <StatMetric value={formatNumber(rowCounts.test_patients)} label="Test patients" subtitle="Held out" tone="warning" />
        </div>
        <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
          Raw MIMIC data is ODbL-licensed and not committed or exposed here. Target column preserved as original five-level ESI acuity.
        </div>
      </SectionCard>

      {/* Class distribution */}
      <SectionCard title="ESI class distribution (modelling set)" badge={`n = ${formatNumber(total)}`} icon={<BarChart3 className="w-4 h-4" />}>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(lvl => {
            const count = classDist[`ESI ${lvl}`] ?? 0;
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
        <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted">
          ESI 4 has 2 examples (sparse). ESI 5 has 0 (absent) — not fabricated, simply not present in this cohort.
        </div>
      </SectionCard>

      {/* Missing data + features side by side */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <SectionCard title="Missing data (% of modelling rows)" badge="Per feature" icon={<AlertTriangle className="w-4 h-4" />}>
            <div className="space-y-2.5">
              {Object.entries(missing).map(([feature, pct]) => {
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
            <div className="mt-3 text-[10px] text-muted">
              Missingness indicators added during preprocessing (e.g. temperature_missing).
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-6">
          <SectionCard title="Continuous feature summaries" badge="Vitals · pain" icon={<BarChart3 className="w-4 h-4" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="py-2 pr-3 font-medium">Feature</th>
                    <th className="py-2 pr-3 font-medium text-right">n</th>
                    <th className="py-2 pr-3 font-medium text-right">Median</th>
                    <th className="py-2 pr-3 font-medium text-right">Mean</th>
                    <th className="py-2 pr-3 font-medium text-right">Min</th>
                    <th className="py-2 pr-3 font-medium text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {features.map(f => {
                    const s = featStats[f];
                    return (
                      <tr key={f}>
                        <td className="py-2 pr-3 font-medium text-primary">{f}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.n_valid?.toFixed(0) || '—'}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.median?.toFixed(2) || '—'}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.mean?.toFixed(2) || '—'}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.min?.toFixed(2) || '—'}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{s?.max?.toFixed(2) || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-muted">
              Temperature values shown after normalization/validation checks. Arrival transport and chief complaint are categorical/text features — see preprocessing below.
            </div>
          </SectionCard>
        </div>
      </div>

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
              <li><strong>Severe imbalance:</strong> ESI 2 (46.9%) and ESI 3 (43.5%) dominate; ESI 1 is 8.7%.</li>
              <li><strong>Sparse class:</strong> ESI 4 has 2 examples — per-class metrics unstable.</li>
              <li><strong>Absent class:</strong> ESI 5 has 0 labelled rows — probabilities always 0.0.</li>
              <li><strong>Small cohort:</strong> {formatNumber(total)} visits from {formatNumber(modelEval.n_patients)} unique patients.</li>
              <li><strong>Not clinically validated:</strong> Research prototype only.</li>
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
