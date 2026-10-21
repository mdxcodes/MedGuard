import { useState, useMemo } from 'react';
import { AlertTriangle, BarChart3, Filter, Search, Info } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';
import errorData from '../../../reports/evaluation_errors.json';

const ESI_COLORS = {
  1: 'text-rose-600',
  2: 'text-amber-600',
  3: 'text-teal-600',
  4: 'text-slate-600',
  5: 'text-slate-400',
};

function EsiBadge({ level }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${ESI_COLORS[level] || 'text-slate-600'}-100 ${ESI_COLORS[level] || 'text-slate-600'} border-${ESI_COLORS[level] || 'slate'}-200`}>
      ESI {level}
    </span>
  );
}

export default function ErrorAnalysisPage() {
  const [trueFilter, setTrueFilter] = useState('all');
  const [predFilter, setPredFilter] = useState('all');
  const [errorOnly, setErrorOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const records = typeof errorData !== 'undefined' && errorData.records ? errorData.records : [];

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (errorOnly && !r.is_misclassified) return false;
      if (trueFilter !== 'all' && r.true_label !== parseInt(trueFilter)) return false;
      if (predFilter !== 'all' && r.pred_label !== parseInt(predFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.true_label.toString().includes(s) || r.pred_label.toString().includes(s) || (r.error_category || '').includes(s))) {
          return false;
        }
      }
      return true;
    });
  }, [records, trueFilter, predFilter, errorOnly, search]);

  const stats = useMemo(() => {
    const total = records.length;
    const mis = records.filter(r => r.is_misclassified).length;
    const correct = total - mis;
    const acc = total > 0 ? (correct / total * 100).toFixed(1) : '0.0';
    const adj = records.filter(r => r.error_category === 'adjacent').length;
    const multi = records.filter(r => r.error_category === 'multi_level').length;
    return { total, mis, correct, acc, adj, multi };
  }, [records]);

  return (
    <div className="space-y-8">
      <PageShell
        title="Error analysis workbench"
        subtitle="Out-of-fold prediction errors from patient-grouped cross-validation. No patient identifiers are exposed. All records come from samples evaluated on folds where that patient's data was held out."
        breadcrumb="Research · Error Analysis"
      />

      {/* Stats */}
      <SectionCard title="Out-of-fold summary" badge={records?.[0]?.evaluation_protocol || 'patient_grouped_5fold_cv_out_of_fold'}>
        <div className="grid sm:grid-cols-6 gap-3">
          {[
            { label: 'Total samples', value: stats.total },
            { label: 'Correct', value: stats.correct },
            { label: 'Misclassified', value: stats.mis, tone: 'warning' },
            { label: 'OOF accuracy', value: `${stats.acc}%` },
            { label: 'Adjacent (±1)', value: stats.adj },
            { label: 'Multi-level (>1)', value: stats.multi, tone: 'error' },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border border-border bg-surface p-4 ${s.tone === 'warning' ? 'bg-warning-bg/40' : s.tone === 'error' ? 'bg-error-bg/40' : 'bg-surface'}`}>
              <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-2xl font-extrabold text-primary">{s.value}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Filters */}
      <SectionCard title="Filters">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted" />
            <span className="text-sm font-medium text-primary">Filters</span>
          </div>
          <select value={trueFilter} onChange={e => setTrueFilter(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono text-xs">
            <option value="all">True: All</option>
            {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>True: ESI {l}</option>)}
          </select>
          <select value={predFilter} onChange={e => setPredFilter(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono text-xs">
            <option value="all">Pred: All</option>
            {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>Pred: ESI {l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={errorOnly} onChange={e => setErrorOnly(e.target.checked)} className="rounded" />
            <span>Misclassified only</span>
          </label>
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm border border-border rounded-lg pl-8 pr-3 py-1.5 font-mono text-xs" />
          </div>
          <div className="text-[10px] font-mono text-muted ml-auto">
            Showing {filtered.length} of {records.length}
          </div>
        </div>
      </SectionCard>

      {/* Table */}
      <SectionCard title="Error records" badge={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}>
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-surface-lift text-muted flex items-center justify-center">
              <span className="text-[24px]">🔍</span>
            </div>
            <div className="text-sm font-medium text-primary mt-3">No matching records</div>
            <div className="text-[10px] text-muted mt-1">Try clearing some filters or toggling 'Misclassified only'.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-3 pr-3 font-medium">True</th>
                  <th className="py-3 pr-3 font-medium">Pred</th>
                  <th className="py-3 pr-3 font-medium">Error</th>
                  <th className="py-3 pr-3 font-medium text-right">Max prob</th>
                  <th className="py-3 pr-3 font-medium text-right">P(True)</th>
                  <th className="py-3 pr-3 font-medium text-right">P(Pred)</th>
                  <th className="py-3 pr-3 font-medium text-right">Fold</th>
                  <th className="py-3 pr-3 font-medium text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r, i) => (
                  <tr key={i} className={`${r.is_misclassified ? 'bg-warning-bg/30' : ''} hover:bg-surface-lift transition`}>
                    <td className="py-3 pr-3"><EsiBadge level={r.true_label} /></td>
                    <td className="py-3 pr-3"><EsiBadge level={r.pred_label} /></td>
                    <td className="py-3 pr-3">
                      {r.is_misclassified
                        ? (r.error_category === 'adjacent' ? <span className="text-[10px] font-mono text-warning font-medium">Adjacent ±1</span> : r.error_category === 'multi_level' ? <span className="text-[10px] font-mono text-error font-medium">Multi-level</span> : <span className="text-[10px] font-mono text-secondary font-medium">Other</span>)
                        : <span className="text-[10px] font-mono text-primary font-medium">Correct</span>}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{r.max_prob * 100}%</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{r.prob_true * 100}%</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{r.prob_pred * 100}%</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{r.fold}</td>
                    <td className="py-3 pr-3">
                      <button onClick={() => setSelected(r)} className="text-[10px] font-medium text-primary hover:underline font-mono">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Limitations */}
      <SectionCard title="Limitations" badge="Read carefully" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-secondary leading-relaxed">
          <li><strong className="text-primary">OOF predictions</strong> are from patient-grouped 5-fold CV on the modelling set (207 samples).</li>
          <li><strong className="text-primary">ESI 4</strong> has only 2 examples; <strong className="text-primary">ESI 5</strong> has 0 labelled examples.</li>
          <li>Adjacent errors (±1 ESI level) are often less clinically severe than multi-level jumps.</li>
          <li>These are aggregate evaluation patterns — not causal explanations.</li>
          <li>No patient identifiers or raw features beyond what the model used are exposed.</li>
        </ul>
      </SectionCard>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="fixed inset-0 bg-navy-deep/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="bg-surface rounded-xl border border-border shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-primary text-lg">Error case detail</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted block">True:</span> <EsiBadge level={selected.true_label} /></div>
              <div><span className="text-muted block">Pred:</span> <EsiBadge level={selected.pred_label} /></div>
              <div className="col-span-2"><span className="text-muted block">Error:</span> {selected.is_misclassified ? selected.error_category : 'Correct'}</div>
              <div><span className="text-muted block">Max prob:</span> <span className="font-mono text-secondary">{selected.max_prob * 100}%</span></div>
              <div><span className="text-muted block">Fold:</span> <span className="font-mono text-secondary">{selected.fold}</span></div>
              <div><span className="text-muted block">P(True):</span> <span className="font-mono text-secondary">{selected.prob_true * 100}%</span></div>
              <div><span className="text-muted block">P(Pred):</span> <span className="font-mono text-secondary">{selected.prob_pred * 100}%</span></div>
            </div>
            <div className="text-[10px] text-secondary leading-relaxed bg-surface-lift rounded-lg p-3 border border-border">
              Out-of-fold prediction for a sample in the evaluation set. No raw patient data or identifiers are shown.
            </div>
            <button onClick={() => setSelected(null)} className="w-full bg-primary text-white py-2.5 rounded-xl hover:bg-primary-hover transition font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
