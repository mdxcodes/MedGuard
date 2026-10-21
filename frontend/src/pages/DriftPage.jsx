import { Activity } from 'lucide-react';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell, SectionCard } from '../components/ui/states';

export default function DriftPage() {
  return (
    <div className="space-y-8">
      <PageShell
        title="Dataset shift & drift analysis"
        subtitle="Compare an approved reference dataset against a separate comparison dataset. Drift is a measurement, not proof of degraded clinical performance."
        breadcrumb="Advanced Analysis · Dataset Drift"
      />

      <SectionCard title="Analysis status" badge="Reference vs comparison">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Reference</div>
            <div className="text-lg font-extrabold text-primary">Training split</div>
            <div className="text-[10px] text-muted mt-1 font-mono">Triagegeist synthetic</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Comparison</div>
            <div className="text-lg font-extrabold text-primary">None configured</div>
            <div className="text-[10px] text-muted mt-1 font-mono">No independent dataset</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Result</div>
            <div className="text-lg font-extrabold text-secondary">Unavailable</div>
            <div className="text-[10px] text-muted mt-1 font-mono">Insufficient independent data</div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border/50 bg-surface-lift p-4 text-[10px] text-secondary leading-relaxed">
          <p><strong className="text-primary">Data caution:</strong> No second independent dataset is available. Random partitions of the same small cohort are not evidence of real-world temporal or hospital-to-hospital drift.</p>
          <p className="mt-2">Drift measures distribution differences only — it does not imply clinical performance degradation, and absence of detected drift does not imply safety or reliability.</p>
        </div>
      </SectionCard>

      <SectionCard title="Interpretation guide" badge="How to read drift">
        <ul className="space-y-2 text-sm text-secondary leading-relaxed">
          <li><strong className="text-primary">PSI / KS statistics</strong> compare feature distributions between reference and comparison sets.</li>
          <li><strong className="text-primary">Missingness shifts</strong> highlight data-collection differences, not model issues.</li>
          <li>Small sample sizes reduce statistical power — treat any drift signal as a hypothesis to investigate, not a confirmed finding.</li>
          <li>Never combine synthetic benchmark results with empirical results into a single drift score.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
