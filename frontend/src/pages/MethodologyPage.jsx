import { Link } from 'react-router-dom';
import { Waves, Activity, BrainCircuit, BarChart3, ShieldCheck, AlertTriangle } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

const STEPS = [
  { step: '01', title: 'Dataset audit', desc: 'Dataset identity, checksum verification, row counts, target distribution verified against MIMIC-IV-ED v2.2 demo.' },
  { step: '02', title: 'Cleaning', desc: 'Temperature C/F split · BP envelope validation · pain parsing · chief complaint normalization.' },
  { step: '03', title: 'Feature pipeline', desc: 'Leakage-safe ColumnTransformer: median imputation, StandardScaler, OneHotEncoder, TF-IDF, missing indicators.' },
  { step: '04', title: 'Split', desc: 'Patient-grouped GroupShuffleSplit and GroupKFold. Zero patient overlap verified by assertion.' },
  { step: '05', title: 'Explain', desc: 'Exact tree-based SHAP via TreeExplainer. Feature names match transformed pipeline output.' },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <PageShell
        title="Methodology"
        subtitle="How MedGuard was built — from MIMIC-IV-ED audit through API inference. Every stage uses verified, documented data and reproducible code."
        breadcrumb="Research · Methodology"
      />

      <SectionCard title="Pipeline stages" badge="Five steps">
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

      <SectionCard title="What SHAP explains — and what it does not" badge="Interpretability">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-sm text-secondary leading-relaxed mb-4">
            SHAP (SHapley Additive exPlanations) measures how each transformed feature pushes a prediction toward or away from a given ESI class.
            Positive SHAP values support the predicted class; negative values oppose it. These are statistical attributions in a tree ensemble —
            they do <strong>not</strong> establish biological causation, pathological mechanism, or clinical justification. A feature with high SHAP
            is not necessarily the clinical cause; it is the model's most sensitive input.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Explicit limitations" badge="Documented, not hidden" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-secondary list-disc list-inside leading-relaxed">
          <li><strong>Not clinically validated.</strong> This is an educational demonstration only.</li>
          <li><strong>No ESI 5 training support.</strong> Zero examples; predictions always 0.0.</li>
          <li><strong>ESI 4 sparse.</strong> 2 examples; metrics unstable.</li>
          <li><strong>Small cohort.</strong> 207 visits / 56 patients from a demo subset.</li>
          <li><strong>No age feature.</strong> MIMIC-IV core patients table unavailable.</li>
          <li><strong>Probabilities not calibrated.</strong> Not suitable for clinical probability estimation.</li>
          <li><strong>Private data.</strong> MIMIC data is ODbL-licensed; not uploaded or committed.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
