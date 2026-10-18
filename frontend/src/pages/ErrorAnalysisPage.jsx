import { useState, useMemo } from 'react';
import { AlertTriangle, BarChart3, Filter, Search, Info } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import errorData from '../../../reports/evaluation_errors.json';

const ESI_COLORS = {
  1: 'bg-rose-100 text-rose-800 border-rose-200',
  2: 'bg-amber-100 text-amber-800 border-amber-200',
  3: 'bg-teal-100 text-teal-800 border-teal-200',
  4: 'bg-slate-100 text-slate-800 border-slate-200',
  5: 'bg-slate-100 text-slate-600 border-slate-200',
};

function EsiBadge({ level }) {
  const cls = ESI_COLORS[level] || 'bg-slate-100 text-slate-800 border-slate-200';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${cls}`}>ESI {level}</span>;
}

function ErrorCategoryBadge({ cat }) {
  if (!cat) return null;
  const map = {
    adjacent: 'bg-amber-50 text-amber-700 border-amber-200',
    multi_level: 'bg-rose-50 text-rose-700 border-rose-200',
    other: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  const cls = map[cat] || map.other;
  const label = cat === 'adjacent' ? 'Adjacent (±1)' : cat === 'multi_level' ? 'Multi-level (>1)' : 'Other';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>{label}</span>;
}

export default function ErrorAnalysisPage() {
  const [trueFilter, setTrueFilter] = useState('all');
  const [predFilter, setPredFilter] = useState('all');
  const [errorOnly, setErrorOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const records = errorData.records || [];

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
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Error Analysis Workbench</h1>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
          Out-of-fold (patient-grouped) prediction errors from cross-validation of the selected Random Forest model.
          No patient identifiers are exposed. All records come from samples evaluated on folds where that patient's
          data was held out. Synthetic demo scenarios are separate from these evaluation records.
        </p>
        <div className="text-xs text-text-muted font-mono bg-slate-50 px-2 py-1 rounded border border-border-subtle inline-block">
          Evaluation protocol: {errorData.records?.[0]?.evaluation_protocol || 'patient_grouped_5fold_cv_out_of_fold'}
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total samples', value: stats.total },
          { label: 'Correct', value: stats.correct },
          { label: 'Misclassified', value: stats.mis, tone: 'amber' },
          { label: 'Accuracy (OOF)', value: `${stats.acc}%` },
          { label: 'Adjacent (±1)', value: stats.adj },
          { label: 'Multi-level (>1)', value: stats.multi, tone: 'rose' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-border-subtle bg-white p-3 ${s.tone === 'amber' ? 'bg-amber-50/40' : s.tone === 'rose' ? 'bg-rose-50/40' : 'bg-white'}`}>
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-extrabold text-navy mt-1">{s.value}</div>
          </div>
        ))}
      </section>

      {/* Filters */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-sm font-medium text-navy">Filters</span>
          </div>
          <select value={trueFilter} onChange={e => setTrueFilter(e.target.value)} className="text-sm border border-border-subtle rounded-lg px-2 py-1.5">
            <option value="all">True: All</option>
            {[1,2,3,4,5].map(l => <option key={l} value={l}>True: ESI {l}</option>)}
          </select>
          <select value={predFilter} onChange={e => setPredFilter(e.target.value)} className="text-sm border border-border-subtle rounded-lg px-2 py-1.5">
            <option value="all">Pred: All</option>
            {[1,2,3,4,5].map(l => <option key={l} value={l}>Pred: ESI {l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={errorOnly} onChange={e => setErrorOnly(e.target.checked)} className="rounded" />
            Misclassified only
          </label>
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-text-muted absolute left-2 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full text-sm border border-border-subtle rounded-lg pl-8 pr-2 py-1.5" />
          </div>
          <div className="text-xs text-text-muted ml-auto">
            Showing {filtered.length} of {records.length}
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-muted">True</th>
                <th className="text-left p-3 font-medium text-text-muted">Pred</th>
                <th className="text-left p-3 font-medium text-text-muted">Error</th>
                <th className="text-left p-3 font-medium text-text-muted">Max Prob</th>
                <th className="text-left p-3 font-medium text-text-muted">P(True)</th>
                <th className="text-left p-3 font-medium text-text-muted">P(Pred)</th>
                <th className="text-left p-3 font-medium text-text-muted">Fold</th>
                <th className="text-left p-3 font-medium text-text-muted">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className={`border-b border-border-subtle hover:bg-slate-50/50 ${r.is_misclassified ? 'bg-amber-50/20' : ''}`}>
                  <td className="p-3"><EsiBadge level={r.true_label} /></td>
                  <td className="p-3"><EsiBadge level={r.pred_label} /></td>
                  <td className="p-3">{r.is_misclassified ? <ErrorCategoryBadge cat={r.error_category} /> : <span className="text-xs text-teal font-medium">Correct</span>}</td>
                  <td className="p-3 font-mono tabular-nums">{(r.max_prob * 100).toFixed(1)}%</td>
                  <td className="p-3 font-mono tabular-nums">{(r.prob_true * 100).toFixed(1)}%</td>
                  <td className="p-3 font-mono tabular-nums">{(r.prob_pred * 100).toFixed(1)}%</td>
                  <td className="p-3 font-mono">{r.fold}</td>
                  <td className="p-3">
                    <button onClick={() => setSelected(r)} className="text-xs text-teal hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Limitations */}
      <section className="bg-slate-50 rounded-2xl border border-border-subtle p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-text-muted mt-0.5" />
          <div className="text-xs text-text-muted leading-relaxed space-y-1">
            <p><strong>Limitations:</strong> OOF predictions are from patient-grouped 5-fold CV on the modeling set (207 samples). ESI 4 has only 2 examples; ESI 5 has 0 labeled examples (absent). Adjacent errors (±1 ESI level) are often less clinically severe than multi-level jumps. These are aggregate evaluation patterns, not causal explanations. No patient identifiers or raw features beyond what the model used are exposed.</p>
            <p>Protocol: {errorData.records?.[0]?.evaluation_protocol}. Generated from models trained without that patient's data in each fold.</p>
          </div>
        </div>
      </section>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-navy/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl border border-border shadow-elevated max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-navy text-lg">Error Case Detail</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-text-muted">True:</span> <EsiBadge level={selected.true_label} /></div>
              <div><span className="text-text-muted">Pred:</span> <EsiBadge level={selected.pred_label} /></div>
              <div className="col-span-2"><span className="text-text-muted">Error:</span> {selected.is_misclassified ? <ErrorCategoryBadge cat={selected.error_category} /> : 'Correct'}</div>
              <div><span className="text-text-muted">Max Prob:</span> <span className="font-mono">{(selected.max_prob*100).toFixed(2)}%</span></div>
              <div><span className="text-text-muted">Fold:</span> <span className="font-mono">{selected.fold}</span></div>
              <div><span className="text-text-muted">P(True):</span> <span className="font-mono">{(selected.prob_true*100).toFixed(2)}%</span></div>
              <div><span className="text-text-muted">P(Pred):</span> <span className="font-mono">{(selected.prob_pred*100).toFixed(2)}%</span></div>
            </div>
            <div className="text-xs text-text-muted leading-relaxed bg-slate-50 p-3 rounded-lg border border-border-subtle">
              This is an out-of-fold prediction for a sample in the evaluation set. No raw patient data or identifiers are shown. The confidence values shown are the model's predicted class probabilities for this out-of-fold evaluation case.
            </div>
            <button onClick={() => setSelected(null)} className="w-full bg-navy text-white py-2 rounded-xl hover:bg-navy-soft transition">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
