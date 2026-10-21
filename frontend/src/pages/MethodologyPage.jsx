import { Link } from 'react-router-dom';
import { Waves, Activity, BrainCircuit, BarChart3, ShieldCheck, AlertTriangle } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

const STEPS = [
  { step: '01', title: 'Dataset Audit', desc: 'Triagegeist synthetic dataset schema verified, row counts confirmed, target distribution documented.' },
  { step: '02', title: 'Cleaning', desc: 'Vital sign range validation, blood pressure consistency, pain score validation, categorical normalization.' },
  { step: '03', title: 'Feature Pipeline', desc: 'Leakage-safe ColumnTransformer: median imputation, StandardScaler, OneHotEncoder, derived features (shock index, pulse pressure, MAP, BMI).' },
  { step: '04', title: 'Split', desc: 'Patient-grouped GroupShuffleSplit and GroupKFold. Zero patient overlap verified by assertion.' },
  { step: '05', title: 'Explain', desc: 'Exact tree-based SHAP via TreeExplainer. Feature names match transformed pipeline output.' },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <PageShell
        title="Methodology"
        subtitle="How MedGuard was built — from Triagegeist synthetic data audit through API inference. Every stage uses verified, documented data and reproducible code."
        breadcrumb="Research · Methodology"
      />

      <SectionCard title="Pipeline Stages" badge="Five Steps">
        <div className="grid sm:grid-cols-5 gap-2">
          {STEPS.map(s => (
            <div key={s.step} className="rounded-xl border border-border bg-surface p-5 hover:border-primary/30 transition">
              <div className="text-xs font-mono text-primary font-bold">{s.step}</div>
              <h3 className="font-bold text-sm text-primary tracking-tight mt-1">{s.title}</h3>
              <p className="text-xs text-muted mt-2 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="What SHAP Explains — And What It Does Not" badge="Interpretability">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-secondary leading-relaxed mb-4">
            SHAP (SHapley Additive exPlanations) measures how each transformed feature pushes a prediction toward or away from a given ESI class.
            Positive SHAP values support the predicted class; negative values oppose it. These are statistical attributions in a tree ensemble —
            they do <strong>not</strong> establish biological causation, pathological mechanism, or clinical justification. A feature with high SHAP
            is not necessarily the clinical cause; it is the model's most sensitive input.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Explicit Limitations" badge="Documented, Not Hidden" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-secondary list-disc list-inside leading-relaxed">
          <li><strong>Not clinically validated.</strong> This is an educational demonstration only.</li>
          <li><strong>Synthetic dataset.</strong> Results are from synthetic Triagegeist data; not representative of real patient populations.</li>
          <li><strong>Small cohort.</strong> 80,000 training visits demonstrates methodology; generalization to real EDs is limited.</li>
          <li><strong>Rare levels are less certain.</strong> All five ESI levels are present, but the rarest level has fewer examples, so its per-class metrics are the least stable.</li>
          <li><strong>Probabilities not calibrated.</strong> Not suitable for clinical probability estimation.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
