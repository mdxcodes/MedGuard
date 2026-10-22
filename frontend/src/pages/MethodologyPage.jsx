import { Link } from 'react-router-dom';
import { Waves, Activity, BrainCircuit, BarChart3, ShieldCheck, AlertTriangle, Repeat } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

const STEPS = [
  { step: '01', title: 'Dataset Audit', desc: 'Triagegeist synthetic dataset schema verified, row counts confirmed, target distribution documented.' },
  { step: '02', title: 'Cleaning', desc: 'Vital sign range validation, blood pressure consistency, pain score validation, categorical normalization.' },
  { step: '03', title: 'Feature Pipeline', desc: 'Leakage-safe ColumnTransformer: median imputation, StandardScaler, OneHotEncoder, derived features (shock index, pulse pressure, MAP, BMI).' },
  { step: '04', title: 'Split', desc: 'Patient-grouped GroupShuffleSplit and GroupKFold. Zero patient overlap verified by assertion.' },
  { step: '05', title: 'Explain', desc: 'Exact tree-based SHAP via TreeExplainer. Feature names match transformed pipeline output.' },
];

const VALIDATION_RULES = [
  { rule: 'Temperature unit handling', detail: 'Values above 45 °C are treated as Fahrenheit and converted; implausible results become missing and are counted.' },
  { rule: 'Blood pressure consistency', detail: 'Systolic above diastolic is enforced; outliers beyond the 50–250 / 30–150 mmHg envelopes are set to missing.' },
  { rule: 'Pain parsing', detail: 'Textual sentinels and the numeric −1 "not assessed" marker become missing; values outside 0–10 are rejected.' },
  { rule: 'Vital envelopes', detail: 'Heart rate, respiratory rate and oxygen saturation are range-checked; every rejected value is counted per column.' },
  { rule: 'Chief complaint normalisation', detail: 'Free text is reduced to a system category; placeholder sentinels map to the literal `unknown`.' },
  { rule: 'Target integrity', detail: 'Rows without a clinician-assigned label are dropped and counted. The five ESI levels are never collapsed.' },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <PageShell
        title="Methodology"
        subtitle="How MedGuard was built — from Triagegeist synthetic data audit through API inference. Every stage uses verified, documented data and reproducible code."
        breadcrumb="Research Lab · Methodology"
      />

      <SectionCard id="pipeline" title="Pipeline Stages" badge="Five Steps">
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

      <SectionCard id="validation" title="Validation Methodology" badge="Every rule counted" icon={<ShieldCheck className="w-4 h-4" />}>
        <p className="text-sm text-secondary leading-relaxed mb-4">
          Every cleaning rule runs over the full cohort and reports how many values it changed.
          A rule that silently mutates rows would make the audit meaningless, so counts are
          surfaced in the data-quality report rather than discarded.
        </p>
        <ul className="space-y-2.5">
          {VALIDATION_RULES.map((rule) => (
            <li key={rule.rule} className="rounded-lg border border-border bg-surface-lift p-3">
              <div className="text-sm font-semibold text-primary">{rule.rule}</div>
              <p className="text-xs text-secondary mt-1 leading-relaxed">{rule.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted leading-relaxed">
          Missing values are never replaced with a guess. They are imputed from statistics fitted on
          the training partition only, and each imputed column carries a missingness indicator so
          the model can see that the value was absent.
        </p>
      </SectionCard>

      <SectionCard id="reproducibility" title="Reproducibility" badge="Deterministic" icon={<Repeat className="w-4 h-4" />}>
        <p className="text-sm text-secondary leading-relaxed mb-4">
          A single seed (<code className="font-mono text-xs text-primary">20260915</code>) drives the
          split, the estimator&apos;s <code className="font-mono text-xs text-primary">random_state</code> and
          the cross-validation shuffle, so two runs on the same data produce the same splits and the
          same predictions. The model manifest records the seed, the library versions and the
          training class distribution, so an artifact can be compared against the run that produced it.
        </p>
        <div className="rounded-xl border border-border bg-surface-lift p-4">
          <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2">
            Commands that regenerate every artifact
          </div>
          <pre className="text-[11px] font-mono text-secondary leading-relaxed overflow-x-auto">{`venv/bin/python -m backend.ml.run_data_prep        # data-quality report
venv/bin/python -m backend.ml.triagegeist_training   # refit + persist the model
venv/bin/python -m backend.ml.build_reports          # aggregate report artifacts`}</pre>
        </div>
        <p className="mt-4 text-xs text-muted leading-relaxed">
          The report artifacts under <code className="font-mono">reports/</code> are regenerated from the
          same code path that trains the model, so the published metrics describe the deployed
          configuration rather than a separately configured variant.
        </p>
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

      <SectionCard id="limitations" title="Explicit Limitations" badge="Documented, Not Hidden" icon={<AlertTriangle className="w-4 h-4" />}>
        <ul className="space-y-2 text-sm text-secondary list-disc list-inside leading-relaxed">
          <li><strong>Not clinically validated.</strong> This is an educational demonstration only.</li>
          <li><strong>Synthetic dataset.</strong> Results are from synthetic Triagegeist data; not representative of real patient populations.</li>
          <li><strong>Large cohort, synthetic records.</strong> 80,000 training visits demonstrates methodology; generalization to real EDs is untested.</li>
          <li><strong>Rare levels are less certain.</strong> All five ESI levels are present, but the rarest level has fewer examples, so its per-class metrics are the least stable.</li>
          <li><strong>Probabilities not calibrated.</strong> Not suitable for clinical probability estimation.</li>
          <li><strong>Comorbidity history is not served.</strong> The 25 <code className="font-mono text-xs">hx_*</code> flags are joined by the data-preparation pipeline but the deployed model does not use them: the assessment API cannot supply them for a new presentation, and defaulting them would fabricate clinical history.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
