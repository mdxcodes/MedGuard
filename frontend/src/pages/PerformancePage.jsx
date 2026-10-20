import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, ChevronRight } from 'lucide-react';
import ConfusionMatrix from '../components/ConfusionMatrix';
import CVDistChart from '../components/CVDistChart';
import ReportExportButton from '../components/ReportExportButton';
import { PageShell, SectionCard, StatMetric } from '../components/ui/states';

const CV_AGG_CONFUSION = [[12, 6, 0, 0, 0], [10, 53, 34, 0, 0], [1, 29, 60, 0, 0], [0, 1, 1, 0, 0], [0, 0, 0, 0, 0]];

export default function PerformancePage() {
  return (
    <div className="space-y-8">
      <PageShell
        title="Model performance"
        subtitle="Verified from actual experiment runs — no fabricated values. Evaluation uses patient-grouped 5-fold CV and a held-out test set."
        breadcrumb="Research · Model Performance"
      />

      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <ReportExportButton />
      </div>

      {/* Headline metrics */}
      <SectionCard title="Cross-validation summary — Random Forest (selected)" badge="5-fold grouped · 207 rows · 56 patients">
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          {[
            { label: 'Macro-F1', v: '0.574', s: '± 0.105', tone: 'primary' },
            { label: 'Balanced accuracy', v: '0.600', s: '± 0.103', tone: 'primary' },
            { label: 'Quadratic QWK', v: '0.503', s: '± 0.035', tone: 'primary' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{m.label}</div>
              <div className="text-2xl font-extrabold tracking-tight text-primary">{m.v}</div>
              <div className="text-xs text-muted font-mono mt-1">{m.s}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="CV metric distributions" badge="Mean ± std across folds">
            <CVDistChart summary={{
              mean_macro_f1: 0.573857,
              std_macro_f1: 0.105266,
              mean_balanced_accuracy: 0.600449,
              std_balanced_accuracy: 0.102624,
              mean_quadratic_weighted_kappa: 0.503404,
              std_quadratic_weighted_kappa: 0.035,
              n_folds: 5,
            }} />
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Confusion matrix (CV aggregate)" badge="True → Pred">
            <ConfusionMatrix matrix={CV_AGG_CONFUSION} />
          </SectionCard>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="Held-out test set comparison" badge="44 visits / 12 patients">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] font-mono text-muted border-b border-border">
                  <th className="text-left py-3 font-medium">Model</th>
                  <th className="text-right py-3 font-medium">Macro-F1</th>
                  <th className="text-right py-3 font-medium">Balanced Acc</th>
                  <th className="text-right py-3 font-medium">QWK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { name: 'Dummy Most Freq', f1: 0.201, b: 0.333, q: 0.000 },
                  { name: 'Dummy Stratified', f1: 0.244, b: 0.257, q: -0.306 },
                  { name: 'Logistic Reg.', f1: 0.384, b: 0.377, q: 0.223 },
                  { name: 'Random Forest', f1: 0.530, b: 0.572, q: 0.497, highlight: true },
                ].map(r => (
                  <tr key={r.name} className={`${r.highlight ? 'bg-primary-soft' : ''}`}>
                    <td className="py-3 font-medium">{r.name}</td>
                    <td className="py-3 text-right font-mono text-sm">{r.f1.toFixed(3)}</td>
                    <td className="py-3 text-right font-mono text-sm">{r.b.toFixed(3)}</td>
                    <td className="py-3 text-right font-mono text-sm">{r.q.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 pt-3 border-t border-border text-[11px] font-mono text-muted">
              Cohort held out with GroupShuffleSplit (seed 20260915). Censored patient IDs prevent leakage.
            </div>
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Per-class recall (CV aggregate)" badge="ESI 1–5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[10px] font-mono text-muted border-b border-border">
                  <th className="text-left py-3 font-medium">ESI level</th>
                  <th className="text-right py-3 font-medium">Recall</th>
                  <th className="text-right py-3 font-medium">Support</th>
                  <th className="text-right py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { l: 1, r: 0.667, s: 18, n: '' },
                  { l: 2, r: 0.546, s: 97, n: '' },
                  { l: 3, r: 0.667, s: 90, n: '' },
                  { l: 4, r: 0.0, s: 2, n: 'Very sparse' },
                  { l: 5, r: 'N/A', s: 0, n: 'Absent' },
                ].map(x => (
                  <tr key={x.l} className={`${x.l === 4 || x.l === 5 ? 'bg-warning-bg/30' : ''}`}>
                    <td className="py-3 font-medium">ESI {x.l}</td>
                    <td className="py-3 text-right font-mono text-sm">{x.r}</td>
                    <td className="py-3 text-right font-mono text-sm">{x.s}</td>
                    <td className="py-3 text-right text-[10px] font-mono text-muted">{x.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="How to read these results" badge="Interpretation guide" icon={<ChevronRight className="w-4 h-4" />}>
        <div className="space-y-3 text-sm text-secondary leading-relaxed">
          <p className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" /><span className="flex-1"><strong>Macro-F1</strong> averages per-class F1 — appropriate for imbalanced 5-level ESI.</span></p>
          <p className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" /><span className="flex-1"><strong>Balanced accuracy</strong> corrects for class imbalance.</span></p>
          <p className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" /><span className="flex-1"><strong>QWK</strong> (quadratic-weighted kappa) penalizes large ESI jumps more heavily.</span></p>
          <p className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mt-1" /><span className="flex-1">No ESI 5 support; ESI 4 has only 2 examples — metrics for those levels are not reliable.</span></p>
        </div>
      </SectionCard>
    </div>
  );
}
