import React, { useMemo } from 'react';
import { BarChart3, Info, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';
export default function ExplainabilityPage() {
  // Report data loaded at runtime; if unavailable, show empty state
  const [data, setData] = React.useState(null);
  // globalShap data would be loaded from '../../../reports/global_shap.json' at runtime;
  // If the report file is unavailable, the component renders with no chart data.

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-teal" />
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Global SHAP Explorer</h1>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
          Global feature importance computed using SHAP (mean absolute SHAP values) over the held-out patient-grouped
          test split. This describes how much each feature contributes to the model's predictions on average—not
          clinical importance or causation.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
          <span className="bg-slate-50 px-2 py-1 rounded border border-border-subtle font-mono">
            Model: {globalShap.model}
          </span>
          <span className="bg-slate-50 px-2 py-1 rounded border border-border-subtle font-mono">
            Reference: {globalShap.reference_dataset}
          </span>
          <span className="bg-slate-50 px-2 py-1 rounded border border-border-subtle font-mono">
            n={globalShap.n_reference_samples} samples
          </span>
          <span className="bg-slate-50 px-2 py-1 rounded border border-border-subtle font-mono">
            Generated: {globalShap.generated_at}
          </span>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-border shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal" />
            <h2 className="text-lg font-bold text-navy tracking-tight">Mean |SHAP| Feature Importance</h2>
          </div>
          <span className="text-[10px] font-mono text-text-muted bg-slate-50 px-2 py-0.5 rounded-md border border-border-subtle">
            Top {data.length} features
          </span>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barSize={20} margin={{ left: 120, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: '#475569' }} width={110} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v) => [v, 'mean |SHAP|']}
                labelFormatter={(l) => data.find(d => d.feature === l)?.fullFeature || l}
              />
              <Bar dataKey="meanAbsShap" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-slate-50 rounded-2xl border border-border-subtle p-6">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-teal mt-0.5" />
            <div className="space-y-2 text-sm text-text-secondary leading-relaxed">
              <h3 className="font-bold text-navy">About Global SHAP</h3>
              <p>SHAP (SHapley Additive exPlanations) values quantify each feature's contribution to predictions. Mean absolute SHAP is a common global measure of feature importance.</p>
              <p><strong>Important:</strong> This reflects model behavior on the reference dataset only. Higher values do not imply clinical significance, causation, or suitability for decision-making.</p>
            </div>
          </div>
        </section>

        <section className="bg-amber-50/40 rounded-2xl border border-amber-200 p-6">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-amber-700 mt-0.5" />
            <div className="space-y-2 text-sm text-amber-800 leading-relaxed">
              <h3 className="font-bold text-amber-900">Limitations</h3>
              <p>Reference set is the held-out test split (n={globalShap.n_reference_samples}) from patient-grouped evaluation. With small sample sizes and class imbalance, global SHAP estimates have uncertainty.</p>
              <p>Engineered features (shock_index, pulse_pressure, MAP) appear alongside raw vitals. TF-IDF chief complaint tokens and one-hot encoded transport are included in the full feature space.</p>
              <p>ESI 4 is sparse and ESI 5 absent in the demo dataset—these constraints affect what the model can learn.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
