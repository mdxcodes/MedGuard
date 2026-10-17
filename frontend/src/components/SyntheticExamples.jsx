import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const samples = [
  { label: 'Respiratory distress', values: { temperature: 37.2, heartrate: 112, resprate: 28, o2sat: 88, sbp: 94, dbp: 62, pain: 7, arrival_transport: 'AMBULANCE', chiefcomplaint: 'SHORTNESS OF BREATH' } },
  { label: 'Trauma — stable vitals', values: { temperature: 36.5, heartrate: 82, resprate: 14, o2sat: 98, sbp: 128, dbp: 78, pain: 4, arrival_transport: 'WALK IN', chiefcomplaint: 'ARM INJURY' } },
  { label: 'Altered mental status', values: { temperature: 38.1, heartrate: 118, resprate: 22, o2sat: 92, sbp: 102, dbp: 68, pain: 9, arrival_transport: 'AMBULANCE', chiefcomplaint: 'ALTERED LEVEL OF CONSCIOUSNESS' } },
];

export default function SyntheticExamples({ onApply }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="rounded-2xl bg-white border border-border shadow-card p-5">
      <h3 className="font-semibold text-navy tracking-tight mb-3 flex items-center gap-2">
        Synthetic Examples <span className="text-xs font-mono text-text-muted bg-slate-50 px-1.5 py-0.5 rounded">Fictional</span>
      </h3>
      <div className="space-y-2">
        {samples.map((s) => (
          <button
            key={s.label}
            onClick={() => { setPicked(s); onApply(s.values); }}
            className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition font-medium ${picked?.label === s.label ? 'border-teal bg-teal-muted/30 text-teal' : 'border-border-subtle hover:border-teal/30 hover:bg-teal-muted/20 text-navy'}`}
          >
            <div className="flex items-center justify-between">
              <span>{s.label}</span>
              <span className="text-[10px] font-mono text-text-muted">{s.values.arrival_transport}</span>
            </div>
            <div className="text-[11px] text-text-secondary font-normal mt-0.5 truncate">{s.values.chiefcomplaint}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-text-muted leading-relaxed font-mono bg-slate-50 rounded-md px-2.5 py-1.5 border border-border-subtle">
        Examples use synthetic vital-sign values drawn from the audited MIMIC-IV-ED demo ranges. They are not real patient records.
      </div>
    </div>
  );
}
