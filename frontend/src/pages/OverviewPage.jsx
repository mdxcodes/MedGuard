import { Link } from 'react-router-dom';
import { ArrowUpRight, Activity, BrainCircuit, Waves, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import StatusCard from '../components/StatusCard';
import MetricChart from '../components/MetricChart';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <DisclaimerBanner />

      {/* Header */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-deep via-navy-soft to-teal/20 text-white shadow-elevated">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative px-6 md:px-10 py-10 md:py-14">
          <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full px-2.5 py-1 text-[11px] font-mono text-teal-soft mb-5">
            <ShieldCheck className="w-3 h-3" /> Research prototype · v0.2.0-demo · MIMIC-IV-ED v2.2
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tighter leading-[1.05]">MedGuard <span className="font-serif italic font-normal text-teal-soft">Triage One</span></h1>
          <p className="text-base md:text-lg text-white/70 max-w-2xl mt-4 leading-relaxed">Explainable AI for emergency-department triage acuity estimation — a reproducible, leakage-safe ML pipeline trained on the audited MIMIC-IV-ED demo subset with exact SHAP explainability.</p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/assessment" className="inline-flex items-center gap-2 bg-teal hover:bg-teal/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-teal/20 transition">Start assessment <ArrowUpRight className="w-4 h-4" /></Link>
            <Link to="/methodology" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-medium text-sm px-5 py-2.5 rounded-xl border border-white/10 transition">Read methodology</Link>
          </div>
        </div>
      </header>

      <StatusCard />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Performance */}
        <section className="lg:col-span-2" aria-labelledby="perf-heading">
          <h2 id="perf-heading" className="text-xl font-extrabold tracking-tight text-navy mb-4">Evaluated Performance</h2>
          <MetricChart />
          <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200/50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-amber-800">How to read these results</div>
                <ul className="text-xs text-amber-700/80 mt-1 space-y-0.5 list-disc list-inside leading-relaxed">
                  <li><strong>Macro-F1</strong> (primary) averages per-class F1; appropriate for imbalanced 5-level ESI.</li>
                  <li><strong>Balanced accuracy</strong> corrects for class imbalance.</li>
                  <li><strong>QWK</strong> (quadratic-weighted kappa) penalizes large ESI jumps.</li>
                  <li>Values come from <strong>grouped 5-fold CV</strong> (patients never shared) and <strong>held-out test set</strong> (44 visits / 12 patients).</li>
                  <li>No ESI 5 support; ESI 4 has 2 examples — metrics for those levels are not reliable.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Dataset & limitations */}
        <aside className="space-y-4" aria-label="Dataset summary">
          <div className="rounded-2xl bg-white border border-border shadow-card p-5">
            <h3 className="font-bold text-navy tracking-tight mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-teal" /> Dataset Coverage</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat number="207" label="Labelled visits" />
              <Stat number="56" label="Unique patients" />
              <Stat number="15" label="Dropped (no label)" />
              <Stat number="0" label="ESI 5 examples" tone="rose" />
            </div>
            <div className="mt-3 pt-3 border-t border-border-subtle text-[11px] font-mono text-text-muted leading-relaxed">
              ESI 4 support: 2 rows (0.97%). ESI 5: 0 rows. Strong imbalance toward ESI 2–3 (90.3%). Patient repetition significant (max 23 visits/patient).
            </div>
          </div>

          <div className="rounded-2xl bg-navy-deep text-white p-5 shadow-elevated">
            <h3 className="font-bold tracking-tight mb-3">Class Support</h3>
            <div className="space-y-2">
              {[
                { lvl: 1, n: 18, pct: '8.7%', bar: 8.7 },
                { lvl: 2, n: 97, pct: '46.9%', bar: 46.9 },
                { lvl: 3, n: 90, pct: '43.5%', bar: 43.5 },
                { lvl: 4, n: 2, pct: '1.0%', bar: 1.0, note: 'Sparse' },
                { lvl: 5, n: 0, pct: '0.0%', bar: 0, note: 'Absent', tone: 'rose' },
              ].map(s => (
                <div key={s.lvl} className="flex items-center gap-3">
                  <div className="w-8 shrink-0 text-xs font-mono font-medium text-white/60">ESI {s.lvl}</div>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.tone === 'rose' ? 'bg-rose-400' : s.note ? 'bg-amber-400' : 'bg-teal'}`} style={{ width: `${s.bar}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs font-mono text-white/70">{s.n} · {s.pct}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Research method */}
      <section aria-labelledby="method-heading" className="rounded-2xl bg-white border border-border shadow-card p-6 md:p-8">
        <h2 id="method-heading" className="text-xl font-extrabold tracking-tight text-navy mb-4">How MedGuard Works</h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {['Dataset audit', 'Cleaning', 'Feature pipeline', 'Grouped split', 'Cross-validation', 'SHAP explanation', 'API inference'].map(s => (
            <span key={s} className="text-xs font-medium bg-slate-50 text-text-secondary px-3 py-1 rounded-full border border-border-subtle">{s}</span>
          ))}
        </div>
        <div className="grid sm:grid-cols-5 gap-3 text-sm">
          {[
            { title: 'Data Audit', desc: 'MIMIC-IV-ED v2.2 demo · 222 stays · checksum verified.', icon: ShieldCheck },
            { title: 'Cleaning', desc: 'Temperature C/F normalization · BP outlier removal · pain parsing.', icon: Activity },
            { title: 'Pipeline', desc: 'Median impute + scale · one-hot transport · TF-IDF complaint.', icon: BrainCircuit },
            { title: 'Evaluation', desc: 'Patient-grouped 5-fold CV · macro-F1 / QWK / balanced accuracy.', icon: BarChart3 },
            { title: 'Inference', desc: 'Real saved pipeline via FastAPI · exact SHAP attributions.', icon: Waves },
          ].map(step => (
            <a key={step.title} href="/methodology" className="p-4 rounded-xl bg-surface-warm border border-border-subtle hover:border-teal/30 hover:shadow-card-hover transition group">
              <step.icon className="w-5 h-5 text-teal mb-2" />
              <div className="font-bold text-navy text-sm tracking-tight group-hover:text-teal transition">{step.title}</div>
              <div className="text-xs text-text-secondary mt-1 leading-snug">{step.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ number, label }) {
  return <div><div className="text-2xl font-extrabold text-navy leading-none tracking-tight">{number}</div><div className="text-[11px] text-text-muted font-medium">{label}</div></div>;
}
