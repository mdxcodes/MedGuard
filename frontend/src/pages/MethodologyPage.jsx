import { Waves, CheckCircle2 } from 'lucide-react';
export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Methodology</h1>
        <p className="text-sm text-text-secondary mt-2">How MedGuard was built — from MIMIC-IV-ED audit through API inference. Every stage uses verified, documented data and reproducible code.</p>
      </div>

      <div className="grid md:grid-cols-5 gap-2">
        {[
          { step: '01', title: 'Audit', desc: 'Dataset identity, checksum verification, row counts, target distribution verified against MIMIC-IV-ED v2.2 demo.' },
          { step: '02', title: 'Cleaning', desc: 'Temperature C/F split · BP envelope validation · pain parsing · chief complaint normalization.' },
          { step: '03', title: 'Pipeline', desc: 'Leakage-safe ColumnTransformer: median imputation, StandardScaler, OneHotEncoder, TF-IDF, missing indicators.' },
          { step: '04', title: 'Split', desc: 'Patient-grouped GroupShuffleSplit and GroupKFold. Zero patient overlap verified by assertion.' },
          { step: '05', title: 'Explain', desc: 'Exact tree-based SHAP via TreeExplainer. Feature names match transformed pipeline output.' },
        ].map(s => (
          <div key={s.step} className="rounded-2xl bg-white border border-border shadow-card p-5 hover:shadow-card-hover transition">
            <div className="text-xs font-mono text-teal font-bold">{s.step}</div>
            <h3 className="font-bold text-navy text-sm tracking-tight mt-1">{s.title}</h3>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-navy-deep to-navy-soft text-white p-8 shadow-elevated">
        <h2 className="font-extrabold text-2xl tracking-tighter">What SHAP explains — and what it does not</h2>
        <p className="text-white/70 mt-3 leading-relaxed max-w-3xl">SHAP (SHapley Additive exPlanations) measures how each transformed feature pushes a prediction toward or away from a given ESI class. Positive SHAP values support the predicted class; negative values oppose it. These are statistical attributions in a tree ensemble — they do not establish biological causation, pathological mechanism, or clinical justification. A feature with high SHAP is not necessarily the clinical cause; it is the model's most sensitive input.</p>
      </div>

      <section aria-label="Limitations and validation status" className="rounded-2xl bg-rose-50 border border-rose-200 p-6">
        <h3 className="font-bold text-rose-800 mb-2">Explicit limitations (documented, not hidden)</h3>
        <ul className="text-sm text-rose-700 space-y-1 list-disc list-inside leading-relaxed">
          <li><strong>Not clinically validated.</strong> This is an educational demonstration only.</li>
          <li><strong>No ESI 5 training support.</strong> Zero examples; predictions always 0.0.</li>
          <li><strong>ESI 4 sparse.</strong> 2 examples; metrics unstable.</li>
          <li><strong>Small cohort.</strong> 207 visits / 56 patients from a demo subset.</li>
          <li><strong>No age feature.</strong> MIMIC-IV core patients table unavailable.</li>
          <li><strong>Probabilities not calibrated.</strong> Not suitable for clinical probability estimation.</li>
          <li><strong>Private data.</strong> MIMIC data is ODbL-licensed; not uploaded or committed.</li>
        </ul>
      </section>
    </div>
  );
}
