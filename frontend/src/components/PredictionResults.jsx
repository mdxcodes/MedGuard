import { Shield, AlertTriangle } from 'lucide-react';
import QualityWarnings from './QualityWarnings';
import UncertaintyIndicators from './UncertaintyIndicators';
import { PageShell, SectionCard } from '../components/ui/states';

const LEVEL_LABELS = {
  1: { label: 'Highest urgency', tone: 'urgent' },
  2: { label: 'High urgency', tone: 'high' },
  3: { label: 'Moderate urgency', tone: 'moderate' },
  4: { label: 'Low urgency', tone: 'low' },
  5: { label: 'Lowest urgency (absent)', tone: 'absent' },
};

const LEVEL_STYLES = {
  urgent: { bg: 'bg-error-bg', border: 'border-error/20', text: 'text-error', dot: 'bg-error' },
  high: { bg: 'bg-warning-bg', border: 'border-warning/20', text: 'text-warning', dot: 'bg-warning' },
  moderate: { bg: 'bg-primary-soft', border: 'border-primary/20', text: 'text-primary', dot: 'bg-primary' },
  low: { bg: 'bg-surface-lift', border: 'border-border', text: 'text-secondary', dot: 'bg-secondary/30' },
  absent: { bg: 'bg-surface-lift', border: 'border-border', text: 'text-muted', dot: 'bg-muted' },
};

export default function PredictionResults({ result }) {
  if (!result) return null;

  const pred = result.prediction;
  const probs = pred.probabilities || [];
  const maxProb = Math.max(...probs.map(p => p.probability || 0));
  const predClass = pred.predicted_esi_level;
  const levelInfo = LEVEL_LABELS[predClass] ?? LEVEL_LABELS[5];
  const style = LEVEL_STYLES[levelInfo.tone];

  return (
    <section aria-label="Prediction result" className="space-y-6">
      {/* Prediction card */}
      <div className={`rounded-xl border shadow-sm p-6 ${style.bg} ${style.border}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-muted uppercase tracking-wider mb-2">Predicted acuity</div>
            <h2 className="text-4xl font-extrabold tracking-tight text-primary leading-none">ESI {predClass}</h2>
            <p className={`text-sm font-medium mt-1 ${style.text}`}>{levelInfo.label}</p>
            <p className="text-[11px] text-muted mt-3 font-mono">
              Random Forest · 44 train pts · 163 rows · seed 20260915
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className={`flex items-center gap-1.5 text-2xl font-extrabold text-primary leading-none`}>
              {(maxProb * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] font-mono text-muted mt-1">Max probability</div>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border/50">
          <p className="text-sm text-secondary leading-relaxed">
            The model estimates this presentation at <strong>ESI {predClass}</strong>. This is a statistical inference from vitals, derived
            physiology (shock index, pulse pressure, abnormal vital count), arrival context, and chief complaint — <strong>not</strong> a clinical
            diagnosis. The dataset contains no ESI 5 examples and only 2 ESI 4 examples; predictions for those levels should not be interpreted
            as validated.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-surface border border-border/30 px-2.5 py-1 rounded-full text-secondary">
            <Shield className="w-3 h-3 text-primary" /> Research prototype — not clinically validated
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-surface border border-border/30 px-2.5 py-1 rounded-full text-secondary">
            Probabilities not calibrated for clinical use
          </span>
        </div>
      </div>

      {/* Quality Warnings */}
      {result.quality && <SectionCard title="Input quality & OOD warnings" badge="Assessment quality"><QualityWarnings quality={result.quality} /></SectionCard>}

      {/* Uncertainty */}
      {result.uncertainty && <SectionCard title="Prediction uncertainty" badge="Confidence indicators"><UncertaintyIndicators uncertainty={result.uncertainty} /></SectionCard>}

      {/* Probability bars */}
      <SectionCard title="Class probabilities" badge="All 5 ESI levels · not calibrated">
        <div className="space-y-3">
          {probs.map(p => {
            const pct = (p.probability || 0) * 100;
            const isPred = p.esi_level === predClass;
            return (
              <div key={p.esi_level} className="flex items-center gap-3 group">
                <div className="w-10 shrink-0 text-xs font-mono font-medium text-secondary text-right">ESI {p.esi_level}</div>
                <div className="flex-1 h-5 bg-surface-lift rounded-full overflow-hidden relative group-hover:bg-surface/30 transition">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isPred ? 'bg-gradient-to-r from-primary to-primary-soft' : 'bg-border'}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                    aria-label={`ESI ${p.esi_level}: ${pct.toFixed(1)}%`}
                  />
                </div>
                <div className="w-16 text-right text-sm font-mono font-medium tabular-nums text-primary">{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
          ESI 5 has 0 training examples — probability is 0.0 (absent class, not validated). ESI 4 has 2 examples (very sparse).
          These limitations are documented and must not be hidden.
        </div>
      </SectionCard>

      {/* SHAP */}
      <SectionCard title="Model interpretation" badge="SHAP · feature attribution">
        {result.explanation && result.explanation.explanation_status === 'available' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <Metric value={result.explanation.predicted_class} label="Explained class" />
              <Metric value={predClass} label="Predicted class" />
              <Metric value={result.explanation.top_features?.length || 0} label="Top features shown" />
            </div>
            <div className="space-y-1.5">
              {(result.explanation.top_features || []).map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-lift border border-border hover:border-primary/20 transition">
                  <div className="w-28 shrink-0 text-xs font-medium text-primary truncate" title={f.feature}>{f.feature}</div>
                  <div className="flex-1 h-2 bg-surface-lift rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${f.shap_value > 0 ? 'bg-primary' : 'bg-error/40'}`}
                      style={{ width: `${Math.min(Math.abs(f.shap_value) * 200 + 10, 100)}%`, marginLeft: f.shap_value < 0 ? 'auto' : '0' }}
                      aria-label={`${f.feature}: ${f.shap_value.toFixed(3)}`}
                    />
                  </div>
                  <div className={`w-16 text-right text-xs font-mono font-medium ${f.shap_value > 0 ? 'text-primary' : 'text-error'}`}>
                    {f.shap_value > 0 ? '+' : ''}{f.shap_value.toFixed(3)}
                  </div>
                  <div className="w-16 text-right text-[11px] font-mono text-muted">{f.sample_value?.toFixed(2) || '—'}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-secondary leading-relaxed">
              <strong>SHAP</strong> measures how each transformed feature pushes the prediction toward or away from each class. Positive values
              favor the predicted class; negative values oppose it. These are statistical attributions within the tree ensemble — they indicate
              feature sensitivity, not medical causation or pathological etiology.
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border/50 bg-surface-lift p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
            <div className="text-sm font-medium text-primary">Explanation unavailable</div>
            <div className="text-[10px] text-muted mt-1">The prediction is valid; SHAP attribution could not be computed safely. The explanation status is clearly reported rather than fabricated.</div>
          </div>
        )}
      </SectionCard>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Link to="/assessment" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-3 rounded-xl shadow-md shadow-primary/10 transition">
          New assessment <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
        <Link to="/performance" className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary px-4 py-3 rounded-xl border border-border hover:bg-surface-lift transition">
          Model performance <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}

function Metric({ value, label }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-center">
      <div className="text-xl font-extrabold text-primary">{value}</div>
      <div className="text-[10px] font-mono text-muted mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}
