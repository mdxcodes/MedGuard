import React from 'react';
import { Info } from 'lucide-react';

export default function UncertaintyIndicators({ uncertainty }) {
  if (!uncertainty || !uncertainty.available) {
    return (
      <div className="rounded-xl bg-surface-soft border border-border-subtle p-4 text-xs text-text-muted">
        Uncertainty indicators unavailable.
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-primary tracking-tight">Prediction Uncertainty (Research-only)</h3>
        <span className="text-[10px] font-mono text-text-muted bg-surface-soft px-2 py-0.5 rounded-md border border-border-subtle">
          {uncertainty.calibration_status}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-surface-soft border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Max Prob</div>
          <div className="text-xl font-extrabold text-primary mt-1">{(uncertainty.max_prob * 100).toFixed(1)}%</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-soft border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Margin (Top-2)</div>
          <div className="text-xl font-extrabold text-primary mt-1">{(uncertainty.prediction_margin * 100).toFixed(1)}%</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-soft border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Entropy (bits)</div>
          <div className="text-xl font-extrabold text-primary mt-1">{uncertainty.predictive_entropy.toFixed(3)}</div>
        </div>
        <div className="p-3 rounded-xl bg-surface-soft border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Entropy (norm)</div>
          <div className="text-xl font-extrabold text-primary mt-1">{uncertainty.entropy_norm.toFixed(3)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 text-xs text-text-muted leading-relaxed bg-surface-soft p-3 rounded-lg border border-border-subtle">
        <Info className="w-4 h-4 mt-0.5" />
        <p>
          Higher entropy/margin indicate ambiguity; lower max prob suggests less confident prediction. These describe
          model confidence patterns only—not clinical certainty. Calibration not performed due to small sample size and
          class imbalance (ESI 4 sparse, ESI 5 absent).
        </p>
      </div>
    </div>
  );
}
