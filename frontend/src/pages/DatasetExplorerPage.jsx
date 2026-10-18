import React from 'react';
import { Database, AlertTriangle, FileText, BarChart3, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';

// Load sanitized aggregate data from public reports (versioned summaries)
import dataQuality from '../../../reports/data_quality_report.json';
import modelEval from '../../../reports/model_evaluation.json';

const ESI_COLORS = ['#ef4444', '#f59e0b', '#14b8a6', '#64748b', '#94a3b8'];

export default function DatasetExplorerPage() {
  // ESI class distribution (from modeling rows)
  const classDist = dataQuality.label_distribution || {};
  const esiLevels = [1, 2, 3, 4, 5].filter(lvl => classDist.hasOwnProperty(`ESI ${lvl}`) || lvl === 5);
  const distData = esiLevels.map(lvl => {
    const key = `ESI ${lvl}`;
    const count = classDist[key] !== undefined ? classDist[key] : 0;
    return {
      name: key,
      count,
      fill: lvl === 1 ? ESI_COLORS[0] : lvl === 2 ? ESI_COLORS[1] : lvl === 3 ? ESI_COLORS[2] : lvl === 4 ? ESI_COLORS[3] : ESI_COLORS[4],
    };
  });

  // Missing data overview
  const missing = dataQuality.missing_percent || {};
  const missingData = Object.entries(missing).map(([k, v]) => ({
    feature: k,
    pct: Number(v.toFixed(2)),
  }));

  // Feature summaries
  const featStats = dataQuality.feature_stats || {};
  const features = Object.keys(featStats).sort();

  // Row counts
  const rowCounts = dataQuality.row_counts || {};

  const formatNumber = (n) => (n === undefined || n === null ? '—' : n.toLocaleString());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-6 h-6 text-teal" />
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Dataset Explorer</h1>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
          Aggregate statistics from the audited MIMIC-IV-ED v2.2 demo subset used for modeling. Raw patient records are
          not displayed. All values come from versioned research reports.
        </p>
      </header>

      {/* Dataset Overview */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-teal" />
          <h2 className="text-lg font-bold text-navy tracking-tight">Dataset Overview</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Dataset</div>
            <div className="text-base font-semibold text-navy mt-1">{dataQuality.dataset?.name} v{dataQuality.dataset?.version}</div>
            <div className="text-xs text-text-muted mt-0.5">{dataQuality.dataset?.variant}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider">License</div>
            <div className="text-sm font-medium text-navy mt-1">{dataQuality.dataset?.license}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Modeling Rows</div>
            <div className="text-2xl font-extrabold text-navy mt-1">{formatNumber(rowCounts.modelling_rows)}</div>
            <div className="text-xs text-text-muted mt-0.5">From {formatNumber(rowCounts.raw_joined_rows)} joined</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Unique Patients</div>
            <div className="text-2xl font-extrabold text-navy mt-1">{formatNumber(modelEval.n_patients)}</div>
            <div className="text-xs text-text-muted mt-0.5">{formatNumber(rowCounts.train_patients)} train / {formatNumber(rowCounts.test_patients)} test</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border-subtle text-xs text-text-muted leading-relaxed">
          <strong>Note:</strong> {dataQuality.dataset?.license === 'ODbL (Open Database License)' ? 'Raw MIMIC data is ODbL-licensed and not committed or exposed here.' : 'Raw data not exposed.'} Target column preserved as original five-level ESI acuity.
        </div>
      </section>

      {/* Class Distribution */}
      <section className="bg-white rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-bold text-navy tracking-tight">ESI Class Distribution (Modeling Set)</h2>
          </div>
          <span className="text-[10px] font-mono text-text-muted bg-slate-50 px-2 py-0.5 rounded-md border border-border-subtle">
            n={rowCounts.modelling_rows || 0}
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
                cursor={{ fill: '#f1f5f9' }}
                formatter={(v) => [v, 'Count']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {distData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-5 gap-2 mt-4">
          {distData.map(d => (
            <div key={d.name} className="rounded-lg py-2 px-1 text-center bg-slate-50 border border-border-subtle">
              <div className="text-lg font-extrabold text-navy">{d.count}</div>
              <div className="text-[10px] font-mono text-text-muted mt-0.5">{d.name}</div>
              <div className="text-[9px] font-mono text-text-muted">
                {d.count > 0 ? ((d.count / (rowCounts.modelling_rows || 1)) * 100).toFixed(1) + '%' : '0.0%'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Missing Data & Feature Summaries */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Missing Data Overview */}
        <section className="bg-white rounded-2xl border border-border shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-navy tracking-tight">Missing Data (% of Modeling Rows)</h2>
          </div>
          <div className="space-y-2">
            {missingData.map(item => (
              <div key={item.feature} className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium text-navy truncate">{item.feature}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.pct > 10 ? 'bg-amber-400' : item.pct > 5 ? 'bg-amber-300' : 'bg-teal/60'}`}
                    style={{ width: `${Math.min(item.pct, 100)}%` }}
                  />
                </div>
                <div className="w-12 text-right text-xs font-mono tabular-nums">{item.pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-text-muted">
            Missingness indicators added during preprocessing (e.g. temperature_missing). See DATASET_AUDIT.md for handling details.
          </div>
        </section>

        {/* Feature Summaries */}
        <section className="bg-white rounded-2xl border border-border shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-bold text-navy tracking-tight">Continuous Feature Summaries</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted border-b border-border-subtle">
                  <th className="py-2 pr-3 font-medium">Feature</th>
                  <th className="py-2 pr-3 font-medium text-right">n_valid</th>
                  <th className="py-2 pr-3 font-medium text-right">Min</th>
                  <th className="py-2 pr-3 font-medium text-right">Median</th>
                  <th className="py-2 pr-3 font-medium text-right">P75</th>
                  <th className="py-2 pr-3 font-medium text-right">Max</th>
                  <th className="py-2 pr-3 font-medium text-right">Mean</th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => {
                  const s = featStats[f];
                  return (
                    <tr key={f} className="border-b border-border-subtle hover:bg-slate-50/50">
                      <td className="py-2 pr-3 font-medium text-navy">{f}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.n_valid?.toFixed(0) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.min?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.median?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.p75?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.max?.toFixed(2) || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{s?.mean?.toFixed(2) || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            Temperature values shown after normalization/validation checks. Arrival transport and chief complaint are categorical/text features.
          </div>
        </section>
      </div>

      {/* Preprocessing & Limitations */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-border shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-bold text-navy tracking-tight">Preprocessing Transparency</h2>
          </div>
          <ul className="space-y-2 text-sm text-text-secondary leading-relaxed">
            <li><strong className="text-navy">Temperature:</strong> C/F detection and conversion; values outside plausible envelope become missing; missingness indicator added.</li>
            <li><strong className="text-navy">Vitals & BP:</strong> Range validation and consistency checks (e.g. SBP/DBP relationship); outliers handled per audit; missingness indicators added.</li>
            <li><strong className="text-navy">Pain:</strong> Parsed from numeric and sentinel tokens (UA/unable); non-numeric/out-of-range become missing with indicator.</li>
            <li><strong className="text-navy">Chief complaint:</strong> Normalized (case, whitespace), placeholders mapped to 'unknown'; TF-IDF representation (train-fitted vocabulary) with max_features=200, stopwords removed.</li>
            <li><strong className="text-navy">Categoricals:</strong> Arrival transport one-hot encoded with handle_unknown='ignore'.</li>
            <li><strong className="text-navy">Imputation/Scaling:</strong> Median imputation for numeric, StandardScaler for numeric features via ColumnTransformer.</li>
            <li><strong className="text-navy">Leakage control:</strong> Patient-grouped splits (GroupKFold/GroupShuffleSplit). Preprocessing fit only on training data.</li>
          </ul>
          <div className="mt-3 pt-3 border-t border-border-subtle text-xs text-text-muted">
            See <code>backend/ml/features.py</code>, <code>backend/ml/validation.py</code>, and <code>docs/ML_PIPELINE_DESIGN.md</code> for full details.
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/40 to-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h2 className="text-lg font-bold text-rose-800 tracking-tight">Class Imbalance & Limitations</h2>
          </div>
          <ul className="space-y-2 text-sm text-rose-700 leading-relaxed">
            <li><strong>Severe imbalance:</strong> ESI 2 (46.9%) and ESI 3 (43.5%) dominate; ESI 1 is 8.7%.</li>
            <li><strong>Sparse class:</strong> ESI 4 has only {classDist['ESI 4'] || 0} example(s) in modeling set ({Number(((classDist['ESI 4']||0)/(rowCounts.modelling_rows||1))*100).toFixed(2)}%). Per-class metrics are unstable.</li>
            <li><strong>Absent class:</strong> ESI 5 has 0 labeled rows in this cohort. The model has no training signal for ESI 5; probabilities for ESI 5 are 0.0 and predictions cannot be considered validated for that class.</li>
            <li><strong>Small cohort:</strong> {formatNumber(rowCounts.modelling_rows)} visits from {formatNumber(modelEval.n_patients)} unique patients (demo subset). Generalization is limited.</li>
            <li><strong>No age feature:</strong> Age not available in the demo package used.</li>
            <li><strong>Not clinically validated:</strong> Research prototype only. Do not use for real triage or clinical decision-making.</li>
            <li><strong>Probabilities not calibrated:</strong> Raw model probabilities reflect confidence, not calibrated clinical probabilities.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
