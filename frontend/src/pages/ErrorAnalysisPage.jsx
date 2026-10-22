import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, BarChart3, Filter, Search, Info } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

/**
 * The out-of-fold error set is ~13 MB. It is loaded with a dynamic import so
 * Vite code-splits it into its own chunk, fetched only when this page is
 * opened, instead of being inlined into the main bundle that every visitor
 * downloads.
 */
const loadErrorRecords = () =>
  import('../../../reports/evaluation_errors.json').then((module) => module.default?.records ?? []);

/** Maximum number of error rows drawn into the table at once. */
const RENDER_LIMIT = 200;

const ESI_COLORS = {
  1: 'text-esi-1',
  2: 'text-esi-2',
  3: 'text-esi-3',
  4: 'text-esi-4',
  5: 'text-esi-5',
};

function EsiBadge({ level }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${ESI_COLORS[level]} bg-esi-${level}/20 border-esi-${level}/20 text-esi-${level}`}>
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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState([]);

  // Load the (large) error records on demand and show a real loading state.
  useEffect(() => {
    let cancelled = false;
    loadErrorRecords()
      .then((loaded) => {
        if (!cancelled) setRecords(loaded);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Under- and over-triage, derived from the out-of-fold records.
   *
   * On the ESI scale a lower number means higher urgency. A prediction with a
   * *higher* number than the truth therefore assigned the presentation less
   * urgency than it received (under-triage); a *lower* number assigned more
   * urgency than it received (over-triage).
   */
  const triageDirection = useMemo(() => {
    const misclassified = records.filter((r) => r.is_misclassified);
    let under = 0;
    let over = 0;
    const byTrueLevel = {};

    for (const record of misclassified) {
      const delta = record.pred_label - record.true_label;
      if (delta > 0) under += 1;
      else if (delta < 0) over += 1;

      const level = record.true_label;
      if (!byTrueLevel[level]) {
        byTrueLevel[level] = { level, total: 0, correct: 0, under: 0, over: 0 };
      }
      byTrueLevel[level].total += 1;
      if (delta > 0) byTrueLevel[level].under += 1;
      else if (delta < 0) byTrueLevel[level].over += 1;
    }

    for (const record of records) {
      const level = record.true_label;
      if (!byTrueLevel[level]) {
        byTrueLevel[level] = { level, total: 0, correct: 0, under: 0, over: 0 };
      }
      byTrueLevel[level].correct += 1;
    }

    return {
      under,
      over,
      total: misclassified.length,
      byLevel: Object.values(byTrueLevel).sort((a, b) => a.level - b.level),
    };
  }, [records]);

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

  /**
   * Only a bounded number of rows are rendered. The record set holds one
   * entry per out-of-fold prediction (tens of thousands), and drawing them
   * all freezes the browser. The counts above the table always describe the
   * full filtered set, so the summary stays exact.
   */
  const visibleRecords = useMemo(() => filtered.slice(0, RENDER_LIMIT), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const paginatedRecords = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

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
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border-4 border-primary-soft border-t-primary animate-spin"></div>
            <span className="text-sm text-secondary ml-2">Loading evaluation results...</span>
          </div>
        </div>
      )}
      {isLoading ? null : (
        <PageShell
          title="Error analysis workbench"
          subtitle="Out-of-fold prediction errors from patient-grouped cross-validation. No patient identifiers are exposed. All records come from samples evaluated on folds where that patient's data was held out."
          breadcrumb="Research · Error Analysis"
        >

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
                {paginatedRecords.map((r, i) => (
                  <tr key={i} className={`${r.is_misclassified ? 'bg-warning-bg/30' : ''} hover:bg-surface-lift transition`}>
                    <td className="py-3 pr-3"><EsiBadge level={r.true_label} /></td>
                    <td className="py-3 pr-3"><EsiBadge level={r.pred_label} /></td>
                    <td className="py-3 pr-3">
                      {r.is_misclassified
                        ? (r.error_category === 'adjacent' ? <span className="text-[10px] font-mono text-warning font-medium">Adjacent ±1</span> : r.error_category === 'multi_level' ? <span className="text-[10px] font-mono text-error font-medium">Multi-level</span> : <span className="text-[10px] font-mono text-secondary font-medium">Other</span>)
                        : <span className="text-[10px] font-mono text-primary font-medium">Correct</span>}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{pct(r.max_prob)}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{pct(r.prob_true)}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{pct(r.prob_pred)}</td>
                    <td className="py-3 pr-3 text-right font-mono tabular-nums text-secondary">{r.fold}</td>
                    <td className="py-3 pr-3">
                      <button onClick={() => setSelected(r)} className="text-[10px] font-medium text-primary-contrast hover:bg-surface-lift rounded px-2 py-1">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > visibleRecords.length && (
          <p className="mt-3 text-[11px] text-muted leading-relaxed">
            Showing the first {visibleRecords.length.toLocaleString()} of{' '}
            {filtered.length.toLocaleString()} matching records. Narrow the filters to inspect
            specific cases; the counts above always cover the full set.
          </p>
        )}
      </SectionCard>

      {/* Pagination controls */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-[11px] text-muted">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-xs px-2 py-1 rounded-lg border border-border text-secondary hover:bg-surface-lift transition"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-xs px-2 py-1 rounded-lg border border-border text-secondary hover:bg-surface-lift transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
      <SectionCard id="triage-direction" title="Under-triage and over-triage" badge="Derived from out-of-fold errors" icon={<BarChart3 className="w-4 h-4" />}>
        <p className="text-sm text-secondary leading-relaxed mb-4">
          On the ESI scale a lower number means higher urgency. When the model predicts a
          <strong className="text-primary"> higher</strong> number than the clinician-assigned
          truth it has assigned <strong className="text-primary">less urgency</strong> than the
          presentation received — under-triage. When it predicts a lower number it has assigned
          <strong className="text-primary"> more urgency</strong> — over-triage.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg border border-border bg-surface-lift p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Under-triage</div>
            <div className="text-2xl font-extrabold text-primary">{triageDirection.under}</div>
            <div className="text-[11px] text-muted mt-1">
              {triageDirection.total > 0
                ? `${((triageDirection.under / triageDirection.total) * 100).toFixed(1)}% of misclassifications`
                : 'no misclassifications'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-lift p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Over-triage</div>
            <div className="text-2xl font-extrabold text-primary">{triageDirection.over}</div>
            <div className="text-[11px] text-muted mt-1">
              {triageDirection.total > 0
                ? `${((triageDirection.over / triageDirection.total) * 100).toFixed(1)}% of misclassifications`
                : 'no misclassifications'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-lift p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Correctly classified</div>
            <div className="text-2xl font-extrabold text-primary">
              {records.length - triageDirection.total}
            </div>
            <div className="text-[11px] text-muted mt-1">of {records.length} out-of-fold records</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-3 font-medium">True level</th>
                <th className="py-2 pr-3 font-medium text-right">Correct</th>
                <th className="py-2 pr-3 font-medium text-right">Under-triage</th>
                <th className="py-2 pr-3 font-medium text-right">Over-triage</th>
                <th className="py-2 pr-3 font-medium text-right">Recall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {triageDirection.byLevel.map((row) => {
                const seen = row.correct + row.under + row.over;
                const recall = seen > 0 ? (row.correct / seen) * 100 : 0;
                return (
                  <tr key={row.level}>
                    <td className="py-2 pr-3 font-medium text-primary">ESI {row.level}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{row.correct}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{row.under}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-secondary">{row.over}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-primary">{recall.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-muted leading-relaxed">
          These are aggregate evaluation patterns computed from the out-of-fold predictions, not
          causal explanations. A direction of error does not by itself establish clinical harm:
          the model was fitted on synthetic data and has not been validated against real triage
          decisions.
        </p>
      </SectionCard>

      {/* Limitations */}
      <SectionCard title="Limitations" badge="Read carefully" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-secondary leading-relaxed">
          <li><strong className="text-primary">OOF predictions</strong> are from patient-grouped 5-fold CV on the modelling set ({records.length.toLocaleString()} samples).</li>
          <li><strong className="text-primary">Class balance:</strong> every ESI level is represented, but <strong className="text-primary">ESI 1</strong> is the rarest — errors concentrate on the dominant levels.</li>
          <li>Adjacent errors (±1 ESI level) are often less clinically severe than multi-level jumps.</li>
          <li>These are aggregate evaluation patterns — not causal explanations.</li>
          <li>No patient identifiers or raw features beyond what the model used are exposed.</li>
        </ul>
      </SectionCard>

        </PageShell>
      )}


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
              <div><span className="text-muted block">Max prob:</span> <span className="font-mono text-secondary">{pct(selected.max_prob)}</span></div>
              <div><span className="text-muted block">Fold:</span> <span className="font-mono text-secondary">{selected.fold}</span></div>
              <div><span className="text-muted block">P(True):</span> <span className="font-mono text-secondary">{pct(selected.prob_true)}</span></div>
              <div><span className="text-muted block">P(Pred):</span> <span className="font-mono text-secondary">{pct(selected.prob_pred)}</span></div>
            </div>
            <div className="text-[10px] text-secondary leading-relaxed bg-surface-lift rounded-lg p-3 border border-border">
              Out-of-fold prediction for a sample in the evaluation set. No raw patient data or identifiers are shown.
            </div>
            <button onClick={() => setSelected(null)} className="w-full bg-primary text-primary-contrast py-2.5 rounded-xl hover:bg-primary-hover transition font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Format a 0–1 probability as a whole percent without float noise. */
function pct(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}
