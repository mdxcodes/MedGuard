import DisclaimerBanner from '../components/DisclaimerBanner';
import drift from '../../../reports/drift_analysis.json';

export default function DriftPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />
      <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Dataset Shift & Drift Analysis</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-3 text-sm">
        <div><span className="text-text-muted">Status:</span> {drift.status}</div>
        <div><span className="text-text-muted">Reference:</span> {drift.reference} (n={drift.sample_sizes?.ref})</div>
        <div><span className="text-text-muted">Comparison:</span> {drift.comparison} (n={drift.sample_sizes?.comp})</div>
        <div className="text-text-muted">Note: {drift.note}</div>
        <div className="mt-3">
          <div className="font-semibold mb-2">Numeric PSI (limited)</div>
          {Object.entries(drift.numeric_psi || {}).map(([k,v]) => (
            <div key={k} className="grid grid-cols-2 gap-2 py-1 border-t border-border-subtle">
              <div>{k}</div>
              <div className="font-mono">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
