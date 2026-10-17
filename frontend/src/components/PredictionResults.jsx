import { BarChart3, ArrowUpRight, Shield, AlertTriangle } from 'lucide-react';

export default function PredictionResults({ result }) {
  if (!result) return null;

  const pred = result.prediction;
  const probs = pred.probabilities || [];
  const maxProb = Math.max(...probs.map(p => p.probability || 0));
  const predClass = pred.predicted_esi_level;

  // ESI visual treatment — restrained, semantic
  const getLevelStyle = (lvl) => {
    if (lvl === 1) return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Highest urgency' };
    if (lvl === 2) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'High urgency' };
    if (lvl === 3) return { bg: 'bg-teal-muted/40', border: 'border-teal/20', text: 'text-teal', label: 'Moderate urgency' };
    if (lvl === 4) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate', label: 'Low urgency' };
    return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate', label: 'Lowest urgency (absent in data)' };
  };
  const style = getLevelStyle(predClass);

  return (
    <section aria-label="Prediction result" className="space-y-6">
      {/* Prediction card */}
      <div className={`rounded-2xl border shadow-card ${style.bg} ${style.border} p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tighter text-navy leading-none">ESI {predClass}</h2>
            <p className={`text-sm font-medium mt-1 ${style.text}`}>{style.label}</p>
            <p className="text-xs text-text-secondary mt-2">Predicted by Random Forest (44 train pts · 163 rows · seed 20260915)</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-extrabold text-navy leading-none">{(maxProb * 100).toFixed(0)}%</div>
            <div className="text-[10px] font-mono text-text-muted mt-1">max probability</div>
          </div>
        </div>

        <div className="mt-4 text-sm text-text-secondary leading-relaxed">
          The model estimates this presentation at <strong>ESI {predClass}</strong>. This is a statistical inference from vitals, derived physiology (shock index, pulse pressure, abnormal vital count), arrival context, and chief complaint — not a clinical diagnosis. The dataset contains no ESI 5 examples and only 2 ESI 4 examples; predictions for those levels should not be interpreted as validated.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-white/60 border border-white/30 px-2.5 py-1 rounded-full text-navy">
            <Shield className="w-3 h-3 text-teal" /> Research prototype — not clinically validated
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-white/60 border border-white/30 px-2.5 py-1 rounded-full text-text-secondary">
            Probabilities not calibrated for clinical use
          </span>
        </div>
      </div>

      {/* Probability bars */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-navy tracking-tight flex items-center gap-2">Class Probabilities <span className="text-xs font-mono text-text-muted bg-slate-50 px-1.5 py-0.5 rounded">5 levels · [1,2,3,4,5]</span></h3>
          <span className="text-[11px] text-text-muted font-mono">Not clinically calibrated</span>
        </div>
        <div className="space-y-3">
          {probs.map(p => {
            const pct = (p.probability || 0) * 100;
            const isPred = p.esi_level === predClass;
            return (
              <div key={p.esi_level} className="flex items-center gap-3">
                <div className="w-10 shrink-0 text-xs font-mono font-medium text-text-secondary text-right">ESI {p.esi_level}</div>
                <div className="flex-1 h-5 bg-slate-50 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isPred ? 'bg-gradient-to-r from-teal to-teal-soft' : 'bg-slate-200'}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                    aria-label={`ESI ${p.esi_level}: ${pct.toFixed(1)}%`}
                    title={`ESI ${p.esi_level}: ${pct.toFixed(1)}%`}
                  />
                </div>
                <div className="w-14 text-right text-sm font-mono font-medium tabular-nums text-navy">{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border-subtle text-[11px] text-text-muted leading-relaxed font-mono">
          ESI 5 has 0 training examples — probability is 0.0 (absent class, not validated). ESI 4 has 2 examples (sparse). These limitations are documented and must not be hidden.
        </div>
      </div>

      {/* SHAP */}
      <div className="bg-white rounded-2xl border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy tracking-tight flex items-center gap-2">Model Interpretation <span className="text-xs font-mono text-text-muted bg-slate-50 px-1.5 py-0.5 rounded">SHAP</span></h3>
          <span className="text-[11px] text-text-muted">Feature-level attribution</span>
        </div>

        {result.explanation && result.explanation.explanation_status === 'available' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <Metric value={result.explanation.predicted_class} label="Explained class" />
              <Metric value={predClass} label="Predicted class" />
              <Metric value={result.explanation.top_features?.length || 0} label="Top features shown" />
            </div>

            <div className="space-y-2">
              {(result.explanation.top_features || []).map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-border-subtle hover:border-teal/20 transition">
                  <div className="w-28 shrink-0 text-xs font-medium text-navy truncate" title={f.feature}>{f.feature}</div>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${f.shap_value > 0 ? 'bg-teal' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(Math.abs(f.shap_value) * 200 + 10, 100)}%`, marginLeft: f.shap_value < 0 ? 'auto' : '0' }}
                      aria-label={`${f.feature}: ${f.shap_value.toFixed(3)}`}
                    />
                  </div>
                  <div className={`w-16 text-right text-xs font-mono font-medium ${f.shap_value > 0 ? 'text-teal' : 'text-rose-600'}`}>{f.shap_value > 0 ? '+' : ''}{f.shap_value.toFixed(3)}</div>
                  <div className="w-16 text-right text-[11px] font-mono text-text-muted">{f.sample_value?.toFixed(2) || '—'}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-sm text-text-secondary leading-relaxed">
              <strong>SHAP</strong> measures how each transformed feature pushes the prediction toward or away from each class. Positive values favor the predicted class; negative values oppose it. These are statistical attributions within the tree ensemble — they indicate feature sensitivity, not medical causation or pathological etiology.
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-border p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-navy">Explanation unavailable</div>
            <div className="text-xs text-text-secondary mt-1">The prediction is valid; SHAP attribution could not be computed safely. The explanation status is clearly reported rather than fabricated.</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <a href="/assessment" className="inline-flex items-center gap-2 bg-navy text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-navy-soft transition shadow-md shadow-navy/10">Back to assessment <ArrowUpRight className="w-3.5 h-3.5" /></a>
        <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-navy px-4 py-2.5 rounded-xl border border-border-subtle hover:bg-slate-50 transition">New synthetic case</button>
        <a href="/performance" className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-teal px-4 py-2.5 rounded-xl border border-border-subtle hover:bg-teal-muted/20 transition">Model performance <ArrowUpRight className="w-3.5 h-3.5" /></a>
      </div>
    </section>
  );
}

function Metric({ value, label }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-border-subtle p-3 text-center">
      <div className="text-xl font-extrabold text-navy">{value}</div>
      <div className="text-[10px] font-mono text-text-muted mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}
