import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity, BrainCircuit, Waves, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import MetricChart from '../components/MetricChart';
import ConfusionMatrix from '../components/ConfusionMatrix';
import { PageShell, SectionCard, StatMetric } from '../components/ui/states';

const CLASS_SUPPORT = [
  { lvl: 1, n: 18, pct: '8.7%', bar: 8.7, tone: 'rose', note: 'Sparse' },
  { lvl: 2, n: 97, pct: '46.9%', bar: 46.9, tone: 'amber', note: 'Dominant' },
  { lvl: 3, n: 90, pct: '43.5%', bar: 43.5, tone: 'teal', note: 'Dominant' },
  { lvl: 4, n: 2, pct: '1.0%', bar: 1.0, tone: 'slate', note: 'Very sparse' },
  { lvl: 5, n: 0, pct: '0.0%', bar: 0, tone: 'slate', note: 'Absent' },
];

const CV_AGG_CONFUSION = [[12, 6, 0, 0, 0], [10, 53, 34, 0, 0], [1, 29, 60, 0, 0], [0, 1, 1, 0, 0], [0, 0, 0, 0, 0]];

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <DisclaimerBanner />

      <PageShell
        title="Understand triage predictions"
        subtitle="Explainable AI for emergency-department triage acuity estimation — a reproducible, leakage-safe ML pipeline trained on the audited MIMIC-IV-ED demo subset with exact SHAP explainability."
        breadcrumb="MedGuard · Triage One"
      />

      {/* Primary action + model status */}
      <section className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <SectionCard title="Start a synthetic assessment" badge="Primary action">
            <p className="text-sm text-secondary mb-6">
              Try the model on a synthetic patient case. All inputs are fictional — no real patient data is used.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const sample = { temperature: 37.2, heartrate: 112, resprate: 28, o2sat: 88, sbp: 94, dbp: 62, pain: 7, arrival_transport: 'AMBULANCE', chiefcomplaint: 'SHORTNESS OF BREATH' };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-primary/20 transition"
              >
                <Activity className="w-4 h-4" /> Respiratory distress
              </button>
              <button
                onClick={() => {
                  const sample = { temperature: 36.5, heartrate: 82, resprate: 14, o2sat: 98, sbp: 128, dbp: 78, pain: 4, arrival_transport: 'WALK IN', chiefcomplaint: 'ARM INJURY' };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 border border-border bg-surface hover:bg-surface-lift text-primary font-semibold px-5 py-3 rounded-xl transition"
              >
                <Activity className="w-4 h-4" /> Stable trauma
              </button>
              <button
                onClick={() => {
                  const sample = { temperature: 38.1, heartrate: 118, resprate: 22, o2sat: 92, sbp: 102, dbp: 68, pain: 9, arrival_transport: 'AMBULANCE', chiefcomplaint: 'ALTERED LEVEL OF CONSCIOUSNESS' };
                  const params = Object.entries(sample).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
                  window.location.href = `/assessment?${params}`;
                }}
                className="flex items-center gap-2 border border-border bg-surface hover:bg-surface-lift text-primary font-semibold px-5 py-3 rounded-xl transition"
              >
                <Activity className="w-4 h-4" /> Altered mental status
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <StatMetric value="Random Forest" label="Active model" subtitle="35 features · seed 20260915" tone="info" />
          <StatMetric value="0.574" label="Macro-F1 (CV)" subtitle="Mean ± std 0.105 across 5 folds" tone="primary" />
          <StatMetric value="44 / 12" label="Holdout cohort" subtitle="Visits / patients — grouped split" tone="warning" />
        </div>
      </section>

      {/* Performance visualization */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Evaluated performance" badge="Grouped 5-fold CV">
            <MetricChart />
          </SectionCard>
        </div>
        <div className="lg:col-span-5 space-y-6">
          <SectionCard title="Confusion matrix (CV aggregate)" badge="True → Pred">
            <ConfusionMatrix matrix={CV_AGG_CONFUSION} />
          </SectionCard>
        </div>
      </div>

      {/* Dataset + limitations row */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Dataset snapshot" badge="MIMIC-IV-ED v2.2 demo">
            <div className="grid sm:grid-cols-3 gap-4">
              <StatMetric value="207" label="Labelled visits" subtitle="After label filtering" tone="primary" />
              <StatMetric value="56" label="Unique patients" subtitle="Grouped split prevents leakage" tone="primary" />
              <StatMetric value="90.3%" label="ESI 2 + 3 share" subtitle="Strong class imbalance" tone="warning" />
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Class support</h4>
              <div className="space-y-1.5">
                {CLASS_SUPPORT.map(s => (
                  <div key={s.lvl} className="flex items-center gap-3">
                    <div className="w-7 shrink-0 text-xs font-mono font-medium text-secondary">{`ESI ${s.lvl}`}</div>
                    <div className="flex-1 h-1.5 bg-surface-lift rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getToneColor(s.tone)}`} style={{ width: `${s.bar}%` }} />
                    </div>
                    <div className="w-16 text-right text-xs font-mono text-secondary">{s.n} · {s.pct}</div>
                    <span className="w-14 text-[10px] font-mono text-muted">{s.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
              ESI 4 has only 2 examples (0.97%) and ESI 5 has 0 — metrics for those levels are not reliable.
              Patient repetition is significant (max 23 visits per patient).
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Read before proceeding" badge="Limitations" icon={<AlertTriangle className="w-4 h-4" />}>
            <ul className="space-y-3 text-sm text-secondary leading-relaxed">
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Accuracy alone is misleading.</strong> With 46.9% ESI 2 and 43.5% ESI 3, macro-F1 and balanced accuracy correct for imbalance.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Grouped cross-validation is mandatory.</strong> One patient contributes up to 23 visits — a row-level split would leak patient memorization.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>ESI 5 is unlearnable.</strong> Zero labelled rows mean probability is always 0.0 — never presented as validated.</span>
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                <span className="flex-1"><strong>Small cohort.</strong> 207 visits / 56 patients demonstrates methodology, not clinical performance.</span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>

      {/* Methods ribbon */}
      <SectionCard title="How MedGuard works" badge="Methodology" icon={<ShieldCheck className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-2 mb-4">
          {['Dataset audit', 'Cleaning', 'Feature pipeline', 'Grouped split', 'Cross-validation', 'SHAP explanation', 'API inference'].map(s => (
            <a key={s} href="/methodology" className="text-xs font-medium bg-surface-soft text-secondary px-3 py-1.5 rounded-full border border-border hover:border-primary/30 hover:text-primary transition">
              {s}
            </a>
          ))}
        </div>
        <div className="grid sm:grid-cols-5 gap-3">
          {[
            { title: 'Data Audit', desc: 'Checksum verified · target distribution confirmed', icon: Waves },
            { title: 'Cleaning', desc: 'Temp C/F · BP outliers · pain parsing', icon: Activity },
            { title: 'Pipeline', desc: 'Median impute · scale · one-hot · TF-IDF', icon: BrainCircuit },
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

function getToneColor(tone) {
  const map = {
    teal: 'bg-teal',
    rose: 'bg-rose-400',
    amber: 'bg-amber-400',
    slate: 'bg-slate-400',
  };
  return map[tone] || 'bg-slate-400';
}
