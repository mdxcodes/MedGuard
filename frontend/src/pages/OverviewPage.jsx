import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity, BrainCircuit, Waves, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import MetricChart from '../components/MetricChart';
import ConfusionMatrix from '../components/ConfusionMatrix';
import { PageShell, SectionCard, StatMetric, LoadingState } from '../components/ui/states';
import { apiFetch } from '../lib/api';

export default function OverviewPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/metrics');
        setMetrics(data);
      } catch (e) {
        setError('Failed to load evaluation metrics.');
      } finally {
        setLoading(false);
      }
    })();
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

  const ds = metrics.dataset || {};
  const classDist = ds.label_distribution || {};
  const totalRows = ds.n_rows ?? 0;
  const m = metrics.metrics || {};
  const holdout = m.holdout || {};
  const cv = m.cv || {};
  const esi1Count = classDist['ESI 1'] ?? 0;
  const esi1Pct = totalRows > 0 ? ((esi1Count / totalRows) * 100).toFixed(2) : '0.0';
  const esi5Count = classDist['ESI 5'] ?? 0;
  const esi23Share = totalRows > 0 ? (((classDist['ESI 2'] ?? 0) + (classDist['ESI 3'] ?? 0)) / totalRows * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-8">
      <DisclaimerBanner />

      <PageShell
        title="Understand Triage Predictions"
        subtitle="Explainable AI for emergency-department triage acuity estimation — a reproducible, leakage-safe ML pipeline trained on the audited Triagegeist synthetic dataset with exact SHAP explainability."
        breadcrumb="MedGuard · Triage One"
      />

      {/* Primary action + model status */}
      <section className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SectionCard title="Start a Synthetic Assessment" badge="Primary Action">
            <p className="text-sm text-secondary mb-6">
              Try the model on a synthetic patient case. All inputs are fictional — no real patient data is used.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const sample = { heart_rate: 112, respiratory_rate: 28, temperature_c: 37.2, spo2: 88, systolic_bp: 94, diastolic_bp: 62, pain_score: 7, arrival_mode: 'AMBULANCE', chief_complaint_system: 'Respiratory', age: 68, sex: 'F', insurance_type: 'Medicare', arrival_hour: 14, shock_index: 1.19, num_prior_ed_visits_12m: 3, num_active_medications: 5 };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-primary/20 transition"
              >
                <Activity className="w-4 h-4" /> Respiratory Distress
              </button>
              <button
                onClick={() => {
                  const sample = { heart_rate: 82, respiratory_rate: 14, temperature_c: 36.5, spo2: 98, systolic_bp: 128, diastolic_bp: 78, pain_score: 4, arrival_mode: 'WALK IN', chief_complaint_system: 'Trauma', age: 32, sex: 'M', insurance_type: 'Private', arrival_hour: 10, shock_index: 0.64, num_prior_ed_visits_12m: 1, num_active_medications: 1 };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 border border-border bg-surface hover:bg-surface-lift text-primary font-semibold px-5 py-3 rounded-xl transition"
              >
                <Activity className="w-4 h-4" /> Stable Trauma
              </button>
              <button
                onClick={() => {
                  const sample = { heart_rate: 118, respiratory_rate: 22, temperature_c: 38.1, spo2: 92, systolic_bp: 102, diastolic_bp: 68, pain_score: 9, arrival_mode: 'AMBULANCE', chief_complaint_system: 'Neurological', age: 74, sex: 'F', insurance_type: 'Medicare', arrival_hour: 2, shock_index: 1.16, num_prior_ed_visits_12m: 5, num_active_medications: 8 };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 border border-border bg-surface hover:bg-surface-lift text-primary font-semibold px-5 py-3 rounded-xl transition"
              >
                <Activity className="w-4 h-4" /> Altered Mental Status
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <StatMetric value={m.model_name ?? 'Random Forest'} label="Active Model" subtitle={ds.random_seed ? `seed ${ds.random_seed}` : ''} tone="info" />
          <StatMetric value={cv.mean_macro_f1?.toFixed(3) ?? '—'} label="Macro-F1 (CV)" subtitle={`± ${cv.std_macro_f1?.toFixed(3)} across ${cv.n_folds ?? 5} folds`} tone="primary" />
          <StatMetric value={`${ds.test_rows ?? '—'} / ${ds.test_patients ?? '—'}`} label="Holdout Cohort" subtitle="Visits / patients — grouped split" tone="warning" />
        </div>
      </section>

      {/* Performance visualization */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Evaluated Performance" badge="Grouped 5-Fold CV">
            <MetricChart
              holdoutMacroF1={holdout.macro_f1}
              holdoutBalancedAcc={holdout.balanced_accuracy}
              holdoutQWK={holdout.quadratic_weighted_kappa}
              cvMacroF1={cv.mean_macro_f1}
              cvStdMacroF1={cv.std_macro_f1}
              cvBalancedAcc={cv.mean_balanced_accuracy}
              cvStdBalancedAcc={cv.std_balanced_accuracy}
              cvQWK={cv.mean_quadratic_weighted_kappa}
              cvStdQWK={cv.std_quadratic_weighted_kappa}
            />
          </SectionCard>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <SectionCard title="Confusion Matrix (CV Aggregate)" badge="True → Pred">
            <ConfusionMatrix matrix={cv.aggregate_confusion_matrix} labels={['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5']} />
          </SectionCard>
        </div>
      </div>

      {/* Dataset + limitations row */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Dataset Snapshot" badge="Triagegeist Synthetic">
            <div className="grid sm:grid-cols-3 gap-4">
              <StatMetric value={totalRows.toLocaleString()} label="Labelled Visits" subtitle="From Triagegeist train.csv" tone="primary" />
              <StatMetric value={ds.n_patients?.toLocaleString() ?? '—'} label="Unique Patients" subtitle="Grouped split prevents leakage" tone="primary" />
              <StatMetric value={esi23Share} label="ESI 2 + 3 Share" subtitle="Strong class imbalance" tone="warning" />
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Class Support</h4>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map(lvl => {
                  const count = classDist[`ESI ${lvl}`] ?? 0;
                  const pct = totalRows > 0 ? ((count / totalRows) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={lvl} className="flex items-center gap-3">
                      <div className="w-7 shrink-0 text-xs font-mono font-medium text-secondary">{`ESI ${lvl}`}</div>
                      <div className="flex-1 h-1.5 bg-surface-lift rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getToneColor(lvl === 4 ? 'slate' : lvl === 5 ? 'slate' : lvl === 1 ? 'rose' : lvl === 2 ? 'amber' : 'teal')}`} style={{ width: `${parseFloat(pct)}%` }} />
                      </div>
                      <div className="w-16 text-right text-xs font-mono text-secondary">{count} · {pct}%</div>
                      <span className="w-14 text-[10px] font-mono text-muted">{lvl === 1 ? 'Rarest' : lvl === 5 ? 'Rare' : lvl === 3 ? 'Dominant' : 'Common'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
              ESI 1 has {esi1Count} examples ({esi1Pct}%) and ESI 5 has {esi5Count} — metrics for the rarer levels are less certain than for the dominant ones.
              Triagegeist supplies one encounter per patient, so patient-grouped splitting is exact.
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Read Before Proceeding" badge="Limitations" icon={<AlertTriangle className="w-4 h-4" />}>
            <ul className="space-y-3 text-sm text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Accuracy alone is misleading.</strong> With severe class imbalance toward ESI 2–3, macro-F1 and balanced accuracy correct for imbalance.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Grouped cross-validation is mandatory.</strong> Patient-grouped splitting prevents leakage from repeated encounters.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>All five ESI levels are present.</strong> Triagegeist supplies labelled examples for every level, though the least common level (ESI 1) is far rarer than the dominant ones.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Synthetic dataset.</strong> {totalRows.toLocaleString()} visits demonstrates methodology, not clinical performance.</span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      {/* Methods ribbon */}
      <SectionCard title="How MedGuard Works" badge="Methodology" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-2 mb-4">
          {['Dataset Audit', 'Cleaning', 'Feature Pipeline', 'Grouped Split', 'Cross-validation', 'SHAP Explanation', 'API Inference'].map(s => (
            <a key={s} href="/methodology" className="text-xs font-medium bg-surface-soft text-secondary px-3 py-1.5 rounded-full border border-border hover:border-primary/30 hover:text-primary transition">
              {s}
            </a>
          ))}
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          {[
            { title: 'Data Audit', desc: 'Schema verified · target distribution confirmed', icon: Waves },
            { title: 'Cleaning', desc: 'Vital sign range checks · missingness indicators', icon: Activity },
            { title: 'Pipeline', desc: 'Median impute · scale · one-hot · derived features', icon: BrainCircuit },
            { title: 'Evaluation', desc: 'Patient-grouped CV · macro-F1 / QWK', icon: BarChart3 },
            { title: 'Inference', desc: 'Saved pipeline · exact SHAP', icon: ShieldCheck },
          ].map(step => (
            <a key={step.title} href="/methodology" className="p-4 rounded-xl bg-surface border border-border hover:border-primary/20 hover:shadow-md transition group">
              <step.icon className="w-4 h-4 text-primary mb-2" />
              <div className="font-bold text-sm text-primary tracking-tight group-hover:text-primary-soft transition">{step.title}</div>
              <div className="text-xs text-muted mt-1 leading-snug">{step.desc}</div>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

const TONE_MAP = { teal: 'bg-teal', rose: 'bg-rose-400', amber: 'bg-amber-400', slate: 'bg-slate-400' };
function getToneColor(tone) { return TONE_MAP[tone] ?? 'bg-slate-400'; }
