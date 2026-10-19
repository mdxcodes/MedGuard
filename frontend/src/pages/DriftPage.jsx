import DisclaimerBanner from '../components/DisclaimerBanner';

export default function DriftPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />
      <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Dataset Shift & Drift Analysis</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card p-6 space-y-3 text-sm">
        <div className="text-text-muted">Status: Unavailable - run experiment to generate drift analysis.</div>
        <div className="text-text-muted">Reference: N/A</div>
        <div className="text-text-muted">Comparison: N/A</div>
        <div className="text-text-muted">Note: Drift analysis requires running the experiment pipeline.</div>
      </div>
    </div>
  );
}
