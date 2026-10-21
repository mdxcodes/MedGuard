import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard, StatMetric } from '../components/ui/states';
import dataQuality from '../../../reports/data_quality_report.json';
import modelEval from '../../../reports/model_evaluation.json';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/metrics');
        setData(data);
      } catch (e) {
        setError('Failed to load evaluation metrics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState message="Loading evaluation metrics…" />;
  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-12">
        <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Metrics unavailable</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !error && data) {
    return (
      <section className="space-y-8">
        <DisclaimerBanner />

        {/* Header */}
        <div className="space-y-8">
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Dataset Overview</h1>
          <p className="text-sm text-text-secondary">
            Aggregate statistics from the audited MIMIC-IV-ED v2.2 demo subset. Raw patient records are not displayed &mdash; all values come from versioned research reports.
          </p>
        </div>

        <section className="bg-white rounded-2xl border border-border shadow-card p-6">
          <h2 className="text-lg font-bold text-navy tracking-tight mb-4">Dataset Overview</h2>
          <div classNamegrid sm:grid-cols-4 gap-4">
            <StatMetric value={totalRows.toLocaleString()} label="Modeling rows" subtitle="From joined dataset" tone="primary" />
            <StatMetric value={formatNumber(modelEval.n_patients)} label="Unique patients" subtitle="Grouped split prevents leakage" tone="primary" />
            <StatMetric value={`${esi23Share}%`} label="ESI 2 + 3 share" subtitle="Strong class imbalance" tone="warning" />
          </div>
          <div className="mt-4 pt-3 border-t border-border text-[11px] font-mono text-muted leading-relaxed">
            ESI 4 has only {esi4Count} examples ({esi4Pct}%) and ESI 5 has {esi5Count} — metrics for those levels are not reliable.
            Patient repetition is significant (max 23 visits per patient).
          </div>
        </div>
      </section>
      <DisclaimerBanner />
