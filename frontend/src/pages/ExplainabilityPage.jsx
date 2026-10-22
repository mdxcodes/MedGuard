import React, { useMemo } from 'react';
import { BarChart3, Info, Lightbulb, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

import globalShapReport from '../../../reports/global_shap.json';

export default function ExplainabilityPage() {
  const report = globalShapReport || null;

  const data = useMemo(() => {
    if (!report || !Array.isArray(report.feature_importances)) return [];
    return report.feature_importances.map((f) => ({
      feature: f.feature.length > 30 ? f.feature.slice(0, 30) + '…' : f.feature,
      fullFeature: f.feature,
      meanAbsShap: Number(f.mean_abs_shap ?? 0),
    }));
  }, [report]);

  return (
    <div className="space-y-8">
      <PageShell
        title="Explainability"
        subtitle="Global feature importance using SHAP (mean absolute SHAP values) over the held-out patient-grouped test split. Describes model behavior — not clinical importance or causation."
        breadcrumb="Research · Explainability"
      />

      {/* Summary chips */}
      <div className="grid sm:grid-cols-4 gap-3 mb-1">
        {[
          { label: 'Model', value: report?.model ?? '—' },
          { label: 'Reference', value: report?.reference_dataset ?? '—' },
          { label: 'Samples', value: report?.n_reference_samples ?? '—' },
          { label: 'Generated', value: report?.generated_at ? new Date(report.generated_at).toLocaleDateString() : '—' },
        ].map(c => (
          <div key={c.label} className="rounded-lg border border-border bg-surface p-3">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{c.label}</div>
            <div className="text-sm font-medium text-primary font-mono">{c.value}</div>
          </div>
        ))}
      </div>

      <SectionCard title="Mean |SHAP| feature importance" badge="Mean absolute SHAP">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barSize={18} margin={{ left: 120, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={{ stroke: 'var(--color-border-subtle)' }} />
              <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} width={110} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border-subtle)', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                formatter={(v) => [v.toFixed(4), 'mean |SHAP|']}
                labelFormatter={(l) => data.find((d) => d.feature === l)?.fullFeature ?? l}
              />
              <Bar dataKey="meanAbsShap" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!report && (
          <div className="py-8 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-surface-lift text-muted flex items-center justify-center">
              <span className="text-[24px]">⚠️</span>
            </div>
            <div className="text-sm font-medium text-primary mt-3">Report unavailable</div>
            <div className="text-[10px] text-muted mt-1">Generate reports/global_shap.json to view feature importance.</div>
          </div>
        )}
      </SectionCard>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <SectionCard title="About Global SHAP" icon={<Info className="w-4 h-4" />}>
            <p className="text-sm text-secondary leading-relaxed">
              SHAP (SHapley Additive exPlanations) values quantify each feature's contribution to predictions. Mean absolute SHAP is a common
              global measure of feature importance — higher values mean the feature is, on average, more influential across the reference set.
            </p>
            <p className="text-sm text-secondary leading-relaxed mt-3">
              <strong className="text-primary">Important:</strong> This reflects model behavior on the reference dataset only. Higher values do
              not imply clinical significance, causation, or suitability for decision-making.
            </p>
          </SectionCard>
        </div>
        <div className="lg:col-span-5">
          <SectionCard title="Limitations" icon={<AlertTriangle className="w-4 h-4" />}>
            <ul className="space-y-2 text-sm text-secondary leading-relaxed">
              <li>Reference set is the held-out test split (n={report?.n_reference_samples ?? 0}) from patient-grouped evaluation — small sample sizes introduce uncertainty.</li>
              <li>Engineered features (shock_index, pulse_pressure, MAP) appear alongside raw vitals; TF-IDF complaint tokens and one-hot transport are included.</li>
              <li>All five ESI levels are present in the Triagegeist cohort; the rarest level (ESI 1) is learned less confidently than the dominant ones.</li>
              <li>SHAP indicates feature sensitivity, not medical causation.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
