import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function MetricChart({
  holdoutMacroF1,
  holdoutBalancedAcc,
  holdoutQWK,
  cvMacroF1,
  cvStdMacroF1,
  cvBalancedAcc,
  cvStdBalancedAcc,
  cvQWK,
  cvStdQWK,
}) {
  return (
    <div className="rounded-2xl bg-surface border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-primary tracking-tight">Cross-Validation Performance (5-fold grouped)</h3>
        <span className="text-[10px] font-mono text-muted bg-surface-soft px-2 py-0.5 rounded-md border border-border-subtle">Macro-F1 ± std</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-[10px] font-mono text-muted">
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">Macro-F1</div>
          <div className="tabular-nums">{cvMacroF1?.toFixed(3)}</div>
          <div className="opacity-70">± {cvStdMacroF1?.toFixed(3)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">Balanced Acc</div>
          <div className="tabular-nums">{cvBalancedAcc?.toFixed(3)}</div>
          <div className="opacity-70">± {cvStdBalancedAcc?.toFixed(3)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">QWK</div>
          <div className="tabular-nums">{cvQWK?.toFixed(3)}</div>
          <div className="opacity-70">± {cvStdQWK?.toFixed(3)}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4 text-[10px] font-mono text-muted">
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">Holdout Macro-F1</div>
          <div className="tabular-nums">{holdoutMacroF1?.toFixed(3)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">Holdout Balanced Acc</div>
          <div className="tabular-nums">{holdoutBalancedAcc?.toFixed(3)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-bold text-primary mb-1">Holdout QWK</div>
          <div className="tabular-nums">{holdoutQWK?.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
