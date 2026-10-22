import { useEffect, useState } from 'react';
import { FileDown, Info } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import ConfusionMatrix from '../components/ConfusionMatrix';
import CVDistChart from '../components/CVDistChart';
import ReportExportButton from '../components/ReportExportButton';
import { PageShell, SectionCard, StatMetric, LoadingState } from '../components/ui/states';
import { apiFetch } from '../lib/api';

const ESI_LABELS = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'];

const fmt = (v, d = 3) => (typeof v === 'number' ? v.toFixed(d) : '—');
const pct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—');

export default function PerformancePage() {
  const [metrics, setMetrics] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiFetch('/api/metrics');
        if (!result.ok) {
          setError(result.error?.message || 'Failed to load evaluation metrics.');
          return;
        }
        const data = result.data;
        if (!cancelled) {
          setMetrics(data.metrics);
          setDataset(data.dataset);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load evaluation metrics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState message="Loading evaluation metrics…" />;
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Metrics unavailable</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nRows = dataset?.n_rows ?? 0;
  const nPatients = dataset?.n_patients ?? 0;
  const CV = metrics?.cv ?? {};
  const CV_SUMMARY = CV ?? {};
  const AGG_CM = CV_SUMMARY.aggregate_confusion_matrix ?? [];
  const HOLDOUT = metrics?.holdout ?? {};
  const PER_CLASS = metrics?.per_class_holdout ?? {};

  return (
    <div className="space-y-8">
      <PageShell
        title="Model performance"
        subtitle="Verified metrics for the model trained on Triagegeist big training — 80 000 labelled visits, patient-grouped 5-fold CV. All values are produced by the reproducible evaluation pipeline."
        breadcrumb="Research · Model Performance"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
          <span className="px-2 py-1 rounded border border-border bg-surface-soft">
            dataset: Triagegeist big training
          </span>
          <span className="px-2 py-1 rounded border border-border bg-surface-soft">
            seed: {dataset?.random_seed ?? '—'}
          </span>
          <span className="px-2 py-1 rounded border border-border bg-surface-soft">
            {nRows.toLocaleString()} rows · {nPatients.toLocaleString()} patients
          </span>
        </div>
        <ReportExportButton />
      </div>

      {/* Headline metrics */}
      <SectionCard id="cross-validation" title="Cross-validation summary" badge="5-fold patient-grouped">
        <div className="grid sm:grid-cols-3 gap-4">
          <StatMetric
            value={fmt(CV_SUMMARY.mean_macro_f1)}
            label="Macro-F1"
            subtitle={`± ${fmt(CV_SUMMARY.std_macro_f1)}`}
            tone="primary"
          />
          <StatMetric
            value={fmt(CV_SUMMARY.mean_balanced_accuracy)}
            label="Balanced accuracy"
            subtitle={`± ${fmt(CV_SUMMARY.std_balanced_accuracy)}`}
            tone="primary"
          />
          <StatMetric
            value={fmt(CV_SUMMARY.mean_quadratic_weighted_kappa)}
            label="Quadratic weighted kappa"
            subtitle={`± ${fmt(CV_SUMMARY.std_quadratic_weighted_kappa)}`}
            tone="primary"
          />
        </div>
        <p className="mt-4 text-xs text-muted leading-relaxed">
          Macro-F1 averages per-class F1, so every ESI level counts equally. Balanced accuracy corrects for class
          imbalance. Quadratic weighted kappa penalises large ESI level jumps more heavily than small ones.
        </p>
      </SectionCard>

      {/* Distribution + confusion matrix */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Fold metric distribution" badge="Mean ± std across folds">
            <CVDistChart
              summary={{
                mean_macro_f1: CV_SUMMARY.mean_macro_f1,
                std_macro_f1: CV_SUMMARY.std_macro_f1,
                mean_balanced_accuracy: CV_SUMMARY.mean_balanced_accuracy,
                std_balanced_accuracy: CV_SUMMARY.std_balanced_accuracy,
                mean_quadratic_weighted_kappa: CV_SUMMARY.mean_quadratic_weighted_kappa,
                std_quadratic_weighted_kappa: CV_SUMMARY.std_quadratic_weighted_kappa,
                n_folds: CV_SUMMARY.n_folds,
              }}
            />
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard id="confusion-matrix" title="Confusion matrix" badge="CV aggregate · true → predicted">
            <ConfusionMatrix matrix={AGG_CM} labels={ESI_LABELS} />
          </SectionCard>
        </div>
      </div>

      {/* Holdout */}
      <SectionCard
        title="Held-out evaluation"
        badge={`${(HOLDOUT.test_rows ?? 0).toLocaleString()} visits · ${(HOLDOUT.test_patients ?? 0).toLocaleString()} patients`}
      >
        <div className="grid sm:grid-cols-3 gap-4">
          <StatMetric value={fmt(HOLDOUT.macro_f1)} label="Macro-F1" subtitle="Holdout" tone="primary" />
          <StatMetric value={fmt(HOLDOUT.balanced_accuracy)} label="Balanced accuracy" subtitle="Holdout" tone="primary" />
          <StatMetric value={fmt(HOLDOUT.quadratic_weighted_kappa)} label="QWK" subtitle="Holdout" tone="primary" />
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-border bg-surface-lift p-3">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Undertriage</div>
            <div className="text-xl font-extrabold text-primary">{HOLDOUT.undertriage_count ?? '—'}</div>
            <div className="text-[11px] text-muted mt-1">Predicted a higher (less urgent) ESI level than the label.</div>
          </div>
          <div className="rounded-lg border border-border bg-surface-lift p-3">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Overtriage</div>
            <div className="text-xl font-extrabold text-primary">{HOLDOUT.overtriage_count ?? '—'}</div>
            <div className="text-[11px] text-muted mt-1">Predicted a lower (more urgent) ESI level than the label.</div>
          </div>
        </div>
      </SectionCard>

      {/* Per class */}
      <SectionCard id="per-class" title="Per-class performance" badge="Held-out split">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-4 font-medium">ESI level</th>
                <th className="py-2 pr-4 font-medium text-right">Precision</th>
                <th className="py-2 pr-4 font-medium text-right">Recall</th>
                <th className="py-2 pr-4 font-medium text-right">F1</th>
                <th className="py-2 font-medium text-right">Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ESI_LABELS.map((label) => {
                const row = PER_CLASS[label];
                if (!row) return null;
                return (
                  <tr key={label}>
                    <td className="py-2 pr-4 font-medium text-primary">{label}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-secondary">{fmt(row.precision)}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-secondary">{fmt(row.recall)}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums text-secondary">{fmt(row.f1)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-secondary">{(row.support ?? 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Class balance note */}
      <SectionCard title="Class distribution" badge="Modelling cohort">
        <div className="grid grid-cols-5 gap-2">
          {ESI_LABELS.map((label) => {
            const count = dataset?.target_distribution_train?.[label] ?? 0;
            const share = nRows > 0 ? (count / nRows) * 100 : 0;
            return (
              <div key={label} className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-xl font-extrabold text-primary">{count.toLocaleString()}</div>
                <div className="text-[10px] font-mono text-muted mt-1">{label}</div>
                <div className="text-[10px] font-mono text-muted">{share.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="rounded-xl border border-border bg-surface-lift p-5">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-secondary leading-relaxed">
            <p className="font-semibold text-primary mb-1">How to read this page</p>
            <p>
              Every metric above is computed on the Triagegeist synthetic dataset with patient-grouped splits, so no
              patient contributes rows to more than one partition. Results describe model behaviour on synthetic data and
              are not evidence of clinical performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
