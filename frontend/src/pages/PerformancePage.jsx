import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import ConfusionMatrix from '../components/ConfusionMatrix';
import CVDistChart from '../components/CVDistChart';
import ReportExportButton from '../components/ReportExportButton';

const CV_AGG_CONFUSION = [[12,6,0,0,0],[10,53,34,0,0],[1,29,60,0,0],[0,1,1,0,0],[0,0,0,0,0]];
const CV_SUMMARY = {
            mean_macro_f1: 0.573857,
            std_macro_f1: 0.105266,
            mean_balanced_accuracy: 0.600449,
            std_balanced_accuracy: 0.102624,
            mean_quadratic_weighted_kappa: 0.503404,
            std_quadratic_weighted_kappa: 0.035000,
            n_folds: 5,
          };

export default function PerformancePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Model Performance</h1>
          <p className="text-sm text-text-secondary mt-1">Verified from docs/MODEL_EVALUATION.md and docs/MODEL_CARD.md. All metrics from actual experiment runs — no fabricated values.</p>
        </div>
        <ReportExportButton />
      </div>

      <div className="bg-gradient-to-r from-navy-deep to-navy-soft text-white rounded-3xl p-8 shadow-elevated">
        <h2 className="text-xl font-extrabold tracking-tight">Cross-Validation Summary — Random Forest (Selected)</h2>
        <p className="text-sm text-white/60 mt-1">5-fold patient-grouped CV · 207 labelled rows · 56 unique patients · seed 20260915</p>
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Macro-F1', v: '0.574', s: '± 0.105', note: 'Mean ± std across folds' },
            { label: 'Balanced Accuracy', v: '0.600', s: '± 0.103', note: 'Per-class mean, corrected for imbalance' },
            { label: 'Quadratic QWK', v: '0.503', s: '± 0.035', note: 'Ordinal agreement — penalizes large ESI jumps' },
          ].map(m => (
            <div key={m.label} className="rounded-xl bg-white/10 border border-white/10 p-4">
              <div className="text-2xl font-extrabold tracking-tight">{m.v} <span className="text-sm font-medium text-teal-soft">{m.s}</span></div>
              <div className="text-xs font-medium text-white/80 mt-1">{m.label}</div>
              <div className="text-[11px] text-white/50 font-mono mt-2">{m.note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-border shadow-card p-6" aria-labelledby="held-heading">
          <h3 id="held-heading" className="text-base font-bold text-navy mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal" /> Held-Out Test Set</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-mono text-text-muted border-b border-border"><th className="text-left py-2 font-medium">Model</th><th className="text-right py-2 font-medium">Macro-F1</th><th className="text-right py-2 font-medium">Balanced Acc</th><th className="text-right py-2 font-medium">QWK</th></tr></thead>
            <tbody>
              {[
                { name: 'Dummy Most Freq', f1: 0.201, b: 0.333, q: 0.000 },
                { name: 'Dummy Stratified', f1: 0.244, b: 0.257, q: -0.306 },
                { name: 'Logistic Reg.', f1: 0.384, b: 0.377, q: 0.223 },
                { name: 'Random Forest', f1: 0.530, b: 0.572, q: 0.497, highlight: true },
              ].map(r => (
                <tr key={r.name} className={`border-b border-border-subtle ${r.highlight ? 'bg-teal-muted/30' : ''}`}>
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 text-right font-mono text-sm">{r.f1.toFixed(3)}</td>
                  <td className="py-2 text-right font-mono text-sm">{r.b.toFixed(3)}</td>
                  <td className="py-2 text-right font-mono text-sm">{r.q.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-text-muted mt-3 font-mono">Cohort: 44 visits / 12 patients · held out with GroupShuffleSplit (seed 20260915)</div>
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-card p-6" aria-labelledby="cv-heading">
          <h3 id="cv-heading" className="text-base font-bold text-navy mb-4">Per-Class Recall (CV Aggregate)</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs font-mono text-text-muted border-b border-border"><th className="text-left py-2">ESI Level</th><th className="text-right py-2">Recall</th><th className="text-right py-2">Support</th><th className="text-right py-2">Note</th></tr></thead>
            <tbody>
              {[{l:1,r:0.667,s:18},{l:2,r:0.546,s:97},{l:3,r:0.667,s:90},{l:4,r:0.0,s:2,n:'Sparse — 0/2'},{l:5,r:'N/A',s:0,n:'Absent — 0 samples'}].map(x=> (
                <tr key={x.l} className="border-b border-border-subtle"><td className="py-2 font-semibold">ESI {x.l}</td><td className="py-2 text-right font-mono">{x.r}</td><td className="py-2 text-right font-mono">{x.s}</td><td className="py-2 text-right text-xs text-text-muted">{x.n}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="text-xs text-text-muted mt-3 font-mono">Source: docs/MODEL_EVALUATION.md §5 — confusion matrix aggregate.</div>
        </section>
      </div>

      <section className="rounded-2xl bg-white border border-border shadow-card p-6" aria-label="Limitations explanation">
        <h3 className="font-bold text-navy mb-3">Why These Metrics Matter (And What They Don't Claim)</h3>
        <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
          <p><strong>Accuracy alone is misleading.</strong> With 46.9% ESI 2 and 43.5% ESI 3, a model that predicts only those two classes achieves ~90% accuracy while failing high-acuity cases entirely. Macro-F1 and balanced accuracy correct for this.</p>
          <p><strong>Grouped cross-validation is mandatory.</strong> One patient contributes up to 23 visits. A row-level split would place the same patient's visits in both training and test, inflating scores through patient memorization.</p>
          <p><strong>ESI 5 is unlearnable.</strong> Zero labelled rows mean the model has no signal. Predictions for Level 5 are always 0.0 in probability; they must never be presented as validated.</p>
          <p><strong>Small cohort limits generalization.</strong> 207 visits from 56 patients is sufficient to demonstrate methodology, not to establish clinical performance. Any claim must wait for the full MIMIC-IV-ED dataset.</p>
        </div>
      </section>
    </div>
  );
}
